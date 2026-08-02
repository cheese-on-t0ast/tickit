use crate::calendar::{
    days_between, month_from_name, nearest_weekday_delta, next_weekday_delta, nth_weekday_of_month,
    qty_to_num, weekday_from_abbrev3, word_to_num, SimpleDate, MONTH_SHORT, WEEKDAY_SHORT,
};
use crate::model::{Group, ParsedCapture, Priority, RepeatRule};
use regex::Regex;
use std::sync::LazyLock;

/// Number word or digit, 1..12 — e.g. "3" or "three".
const NUM: &str = r"(\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)";
/// Like NUM but also accepts the vague colloquial quantities that read as a
/// count in "in a few days" / "a couple of weeks". Longest alternatives first
/// so leftmost-first matching prefers "a couple of" over "a".
const QTY: &str = r"(\d+|a couple of|a couple|a few|several|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|an|a)";
/// Irregular weekday short forms, longest alternative first so e.g.
/// "saturday" doesn't get stuck matching just "sat" and dead-ending before
/// the trailing "urday". First 3 chars of whatever matched always map
/// cleanly via `weekday_from_abbrev3` (tue -> tuesday, wed -> wednesday, etc).
const WD: &str = r"(wednes|thurs|thur|tues|satur|mon|tue|wed|thu|fri|sat|sun)";
/// Same longest-first reasoning for month names/abbreviations.
const MON: &str = r"(january|february|march|april|august|september|october|november|december|june|july|sept|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)";
/// Ordinal position within a month for "the <nth> <weekday> of the month"
/// — words and digit forms, plus "last".
const ORD: &str = r"(first|second|third|fourth|fifth|last|1st|2nd|3rd|4th|5th)";

macro_rules! re {
    ($name:ident, $pat:expr) => {
        static $name: LazyLock<Regex> = LazyLock::new(|| Regex::new($pat).unwrap());
    };
}

re!(
    HIGH_PRIO_RE,
    r"!!!|!!|\burgent\b|\basap\b|\bcritical\b|\b(?:high|highest|top)(?: priority| prio)\b|\bp0\b|\bp1\b"
);
re!(MED_PRIO_RE, r"\bimportant\b|\bmedium(?: priority| prio)\b|\bp2\b|\s!\s");
re!(LOW_PRIO_RE, r"\blow(?: priority| prio)\b|\bno rush\b|\bp3\b");

re!(CLOCK_TIME_RE, r"\b(\d{1,2})(?::(\d{2}))?\s?(am|pm)\b");
// "noon" family (midday / lunchtime) all resolve to 12:00.
re!(NOON_RE, r"\bnoon\b|\bmidday\b|\bmid-day\b|\blunch\s?time\b|\bat lunch\b");
re!(MIDNIGHT_RE, r"\bmidnight\b");
// "end of day" / close-of-business — a same-day deadline at 17:00.
re!(END_OF_DAY_RE, r"\beod\b|\bcob\b|\bend of (?:the )?day\b|\bclose of business\b");
re!(FIRST_THING_RE, r"\bfirst thing\b");
re!(DAY_PART_RE, r"\bmorning\b|\bafternoon\b|\bevening\b|\bnight\b");
// "this morning/afternoon/evening" — today, at that part's default time.
re!(THIS_DAY_PART_RE, r"\bthis (morning|afternoon|evening)\b");

// "the first Thursday of each month" and friends — must be tried before the
// plainer weekday/month forms so the whole phrase is consumed as a unit.
static REPEAT_NTH_DOW_RE: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(&format!(
        r"\b(?:on the |on |the )?{ORD} {WD}(?:day)? of (?:each|every|the) month\b"
    ))
    .unwrap()
});

re!(REPEAT_WEEKDAY_KIND_RE, r"\b(?:every|each) weekday\b|\bon weekdays\b|\bweekdays\b");

// Weekday-with-interval forms, before the bare-week and every-N-weeks forms so
// "every other Thursday" / "every 2 Thursdays" / "every 3 weeks on Thursday"
// aren't half-swallowed by the generic week patterns.
static REPEAT_OTHER_DOW_RE: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(&format!(r"\b(?:every|each) other {WD}(?:day)?\b")).unwrap());
static REPEAT_N_DOW_RE: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(&format!(r"\b(?:every|each) {NUM} {WD}(?:day)?s\b")).unwrap());
static REPEAT_N_WEEKS_ON_DOW_RE: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(&format!(r"\b(?:every|each) {NUM} weeks on {WD}(?:day)?\b")).unwrap()
});

re!(
    REPEAT_OTHER_WEEK_RE,
    r"\b(?:every|each) other week\b|\bbiweekly\b|\bbi-weekly\b|\bfortnightly\b|\bonce a fortnight\b|\b(?:every|each) fortnight\b"
);
static REPEAT_N_WEEKS_RE: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(&format!(r"\b(?:every|each) {NUM} weeks\b")).unwrap());
re!(REPEAT_WEEK_RE, r"\b(?:every|each) week\b|\bweekly\b|\bonce a week\b");
re!(REPEAT_QUARTERLY_RE, r"\bquarterly\b|\b(?:every|each) quarter\b|\bonce a quarter\b");
re!(REPEAT_SEMIANNUAL_RE, r"\bsemi-?annually\b|\btwice a year\b");
static REPEAT_N_MONTHS_RE: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(&format!(r"\b(?:every|each) {NUM} months\b")).unwrap());
re!(REPEAT_MONTH_RE, r"\b(?:every|each) month\b|\bmonthly\b|\bonce a month\b");
static REPEAT_N_DAYS_RE: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(&format!(r"\b(?:every|each) {NUM} days\b")).unwrap());
re!(REPEAT_DAY_RE, r"\b(?:every|each) (?:single )?day\b|\bdaily\b|\bonce a day\b");
static REPEAT_N_YEARS_RE: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(&format!(r"\b(?:every|each) {NUM} years\b")).unwrap());
re!(REPEAT_YEAR_RE, r"\b(?:every|each) year\b|\byearly\b|\bannually\b|\bonce a year\b");
static REPEAT_WEEKDAY_NAME_RE: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(&format!(r"\b(?:every|each) {WD}(?:day)?s?\b")).unwrap());
static REPEAT_ON_WEEKDAYS_RE: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(&format!(r"\bon {WD}(?:day)?s\b")).unwrap());

re!(TONIGHT_RE, r"\btonight\b");
re!(LATER_TODAY_RE, r"\blater today\b");
re!(TODAY_RE, r"\btoday\b");
re!(YESTERDAY_RE, r"\byesterday\b");
re!(DAY_AFTER_TOMORROW_RE, r"\bday after tomorrow\b");
re!(TOMORROW_RE, r"\btomorrow\b|\btmrw\b|\btmr\b|\btmw\b");
static IN_N_DAYS_RE: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(&format!(r"\bin {QTY} days?\b")).unwrap());
static IN_N_WEEKS_RE: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(&format!(r"\bin {QTY} weeks?\b")).unwrap());
static IN_N_MONTHS_RE: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(&format!(r"\bin {QTY} months?\b")).unwrap());
static IN_N_YEARS_RE: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(&format!(r"\bin {QTY} years?\b")).unwrap());
re!(IN_A_FORTNIGHT_RE, r"\bin a fortnight\b");
// "{qty} days/weeks/months from now/today" — unit captured in group 2.
static QTY_FROM_NOW_RE: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(&format!(r"\b{QTY} (days?|weeks?|months?) from (?:now|today)\b")).unwrap());
re!(NEXT_WEEK_RE, r"\bnext week\b");
re!(WEEK_AFTER_NEXT_RE, r"\b(?:the )?week after next\b");
re!(NEXT_WEEKEND_RE, r"\bnext weekend\b");
re!(THIS_WEEKEND_RE, r"\bthis weekend\b|\bthis coming weekend\b|\bover the weekend\b|\bweekend\b");
// "start/beginning of (the/next) week" -> the coming Monday.
re!(START_OF_WEEK_RE, r"\b(?:start|beginning|top) of (?:the |next )?week\b");
re!(END_OF_WEEK_RE, r"\bend of (?:the )?week\b|\beow\b");
re!(END_OF_MONTH_RE, r"\bend of (?:the )?month\b|\beom\b");
re!(END_OF_YEAR_RE, r"\bend of (?:the )?year\b|\beoy\b");
re!(
    BEGINNING_OF_MONTH_RE,
    r"\b(?:beginning|start|first day) of (?:the )?(?:next )?month\b|\bfirst of (?:the |next )?month\b"
);
re!(MID_MONTH_RE, r"\bmid-?month\b|\bmiddle of (?:the |next )?month\b");
re!(MID_WEEK_RE, r"\bmid-?week\b|\bmiddle of (?:the |next )?week\b");
re!(NEXT_MONTH_RE, r"\bnext month\b");
re!(NEXT_YEAR_RE, r"\bnext year\b");
static NEXT_WEEKDAY_RE: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(&format!(r"\bnext {WD}(?:day)?\b")).unwrap());
static LAST_WEEKDAY_RE: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(&format!(r"\blast {WD}(?:day)?\b")).unwrap());
static THIS_OR_BARE_WEEKDAY_RE: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(&format!(r"\b(?:this |this coming |coming |on )?{WD}(?:day)?\b")).unwrap());
static MONTH_DAY_RE: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(&format!(r"\b{MON}\.? (\d{{1,2}})(?:st|nd|rd|th)?\b")).unwrap());
static DAY_MONTH_RE: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(&format!(r"\b(\d{{1,2}})(?:st|nd|rd|th)? of {MON}\b")).unwrap());
re!(NUMERIC_DATE_RE, r"\b(\d{1,2})/(\d{1,2})(?:/(\d{2,4}))?\b");
re!(BARE_ORDINAL_RE, r"\b(?:on |by )?the (\d{1,2})(?:st|nd|rd|th)\b");
// A bare month name behind a preposition ("in March", "next April", "by
// December") -> the 1st of that month, next occurrence.
static PREP_MONTH_RE: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(&format!(r"\b(?:in|by|next|during|sometime in) {MON}\b")).unwrap());
re!(SOMEDAY_RE, r"\bsomeday\b|\bsometime\b|\bone day\b|\beventually\b");

re!(TAG_RE, r"#[\w-]+");
re!(TRAILING_CONNECTOR_RE, r"(?i)[\s,]*\b(of|on|at|by|for|in|the|every|each|this|next)$");

struct Buf {
    low: String,
    keep: String,
}

impl Buf {
    fn new(text: &str) -> Self {
        Self { low: format!(" {} ", text.to_lowercase()), keep: format!(" {} ", text) }
    }

    fn blank(&mut self, start: usize, len: usize) {
        let spaces = " ".repeat(len);
        self.low.replace_range(start..start + len, &spaces);
        self.keep.replace_range(start..start + len, &spaces);
    }
}

/// Matches `re` against the (lowercased) buffer, blanks out the match in both
/// buffers so later patterns can't collide with it, and returns the matched
/// groups as owned strings (group 0 is the whole match).
fn eat(buf: &mut Buf, re: &Regex) -> Option<Vec<Option<String>>> {
    let caps = re.captures(&buf.low)?;
    let whole = caps.get(0).unwrap();
    let start = whole.start();
    let len = whole.end() - start;
    let groups: Vec<Option<String>> = caps.iter().map(|m| m.map(|g| g.as_str().to_string())).collect();
    buf.blank(start, len);
    Some(groups)
}

fn num_from(groups: &[Option<String>], idx: usize) -> u32 {
    groups.get(idx).and_then(|g| g.as_deref()).and_then(word_to_num).unwrap_or(1)
}

/// Like [`num_from`] but also resolves vague quantities ("a", "a few").
fn qty_from(groups: &[Option<String>], idx: usize) -> u32 {
    groups.get(idx).and_then(|g| g.as_deref()).and_then(qty_to_num).unwrap_or(1)
}

fn weekday_from(groups: &[Option<String>], idx: usize) -> Option<u32> {
    let raw = groups.get(idx)?.as_deref()?;
    weekday_from_abbrev3(&raw[..raw.len().min(3)])
}

pub struct ParseInput<'a> {
    pub text: &'a str,
    pub today: SimpleDate,
    pub known_list_ids: &'a [String],
}

pub fn parse(input: ParseInput) -> ParsedCapture {
    let mut buf = Buf::new(input.text);
    let today = input.today;
    let today_wd = today.weekday();

    // 1. Priority markers.
    let mut priority = Priority::Low;
    if eat(&mut buf, &HIGH_PRIO_RE).is_some() {
        priority = Priority::High;
    } else if eat(&mut buf, &MED_PRIO_RE).is_some() {
        priority = Priority::Med;
    } else {
        eat(&mut buf, &LOW_PRIO_RE);
    }

    // 2. Explicit clock time.
    let mut due_time: Option<String> = None;
    if let Some(g) = eat(&mut buf, &CLOCK_TIME_RE) {
        let hour: u32 = g[1].as_ref().unwrap().parse().unwrap_or(12);
        let minute: u32 = g.get(2).and_then(|m| m.as_ref()).and_then(|m| m.parse().ok()).unwrap_or(0);
        let is_pm = g[3].as_deref() == Some("pm");
        let hour24 = match (hour % 12, is_pm) {
            (0, true) => 12,
            (0, false) => 0,
            (h, true) => h + 12,
            (h, false) => h,
        };
        due_time = Some(format!("{:02}:{:02}", hour24, minute));
    } else if eat(&mut buf, &NOON_RE).is_some() {
        due_time = Some("12:00".to_string());
    } else if eat(&mut buf, &MIDNIGHT_RE).is_some() {
        due_time = Some("00:00".to_string());
    }

    // 3. Recurrence — checked as a chain of mutually-exclusive phrasings,
    // "every"/"each" interchangeable everywhere, digits and number-words both
    // accepted for the "every N ..." forms. Ordering runs most-specific first:
    // phrases that embed a weekday or "month" are consumed whole before the
    // plainer patterns get a chance to grab just part of them.
    let mut repeat: Option<RepeatRule> = None;
    // Weekday whose nearest upcoming occurrence should seed the due date when
    // no explicit date word is present ("every Thursday" -> this Thursday).
    let mut repeat_weekday: Option<u32> = None;
    // (week, weekday) of a "first Thursday of the month" rule, likewise used to
    // seed the due date to that rule's next occurrence.
    let mut monthly_dow: Option<(i32, u32)> = None;
    if let Some(g) = eat(&mut buf, &REPEAT_NTH_DOW_RE) {
        if let (Some(week), Some(wd)) = (g[1].as_deref().and_then(week_from_ordinal), weekday_from(&g, 2)) {
            repeat = Some(RepeatRule::MonthlyDow { n: 1, week, weekday: wd });
            monthly_dow = Some((week, wd));
        }
    } else if eat(&mut buf, &REPEAT_WEEKDAY_KIND_RE).is_some() {
        repeat = Some(RepeatRule::Weekday);
    } else if let Some(g) = eat(&mut buf, &REPEAT_OTHER_DOW_RE) {
        if let Some(wd) = weekday_from(&g, 1) {
            repeat = Some(RepeatRule::WeeklyOn { weekday: wd, n: 2 });
            repeat_weekday = Some(wd);
        }
    } else if let Some(g) = eat(&mut buf, &REPEAT_N_DOW_RE) {
        if let Some(wd) = weekday_from(&g, 2) {
            repeat = Some(RepeatRule::WeeklyOn { weekday: wd, n: num_from(&g, 1) });
            repeat_weekday = Some(wd);
        }
    } else if let Some(g) = eat(&mut buf, &REPEAT_N_WEEKS_ON_DOW_RE) {
        if let Some(wd) = weekday_from(&g, 2) {
            repeat = Some(RepeatRule::WeeklyOn { weekday: wd, n: num_from(&g, 1) });
            repeat_weekday = Some(wd);
        }
    } else if eat(&mut buf, &REPEAT_OTHER_WEEK_RE).is_some() {
        repeat = Some(RepeatRule::Weekly { n: 2 });
    } else if let Some(g) = eat(&mut buf, &REPEAT_N_WEEKS_RE) {
        repeat = Some(RepeatRule::Weekly { n: num_from(&g, 1) });
    } else if eat(&mut buf, &REPEAT_WEEK_RE).is_some() {
        repeat = Some(RepeatRule::Weekly { n: 1 });
    } else if eat(&mut buf, &REPEAT_QUARTERLY_RE).is_some() {
        repeat = Some(RepeatRule::Monthly { n: 3, day_of_month: None });
    } else if eat(&mut buf, &REPEAT_SEMIANNUAL_RE).is_some() {
        repeat = Some(RepeatRule::Monthly { n: 6, day_of_month: None });
    } else if let Some(g) = eat(&mut buf, &REPEAT_N_MONTHS_RE) {
        repeat = Some(RepeatRule::Monthly { n: num_from(&g, 1), day_of_month: None });
    } else if eat(&mut buf, &REPEAT_MONTH_RE).is_some() {
        repeat = Some(RepeatRule::Monthly { n: 1, day_of_month: None });
    } else if let Some(g) = eat(&mut buf, &REPEAT_N_DAYS_RE) {
        repeat = Some(RepeatRule::Daily { n: num_from(&g, 1) });
    } else if eat(&mut buf, &REPEAT_DAY_RE).is_some() {
        repeat = Some(RepeatRule::Daily { n: 1 });
    } else if let Some(g) = eat(&mut buf, &REPEAT_N_YEARS_RE) {
        repeat = Some(RepeatRule::Yearly { n: num_from(&g, 1) });
    } else if eat(&mut buf, &REPEAT_YEAR_RE).is_some() {
        repeat = Some(RepeatRule::Yearly { n: 1 });
    } else if let Some(g) = eat(&mut buf, &REPEAT_WEEKDAY_NAME_RE) {
        if let Some(wd) = weekday_from(&g, 1) {
            repeat = Some(RepeatRule::WeeklyOn { weekday: wd, n: 1 });
            repeat_weekday = Some(wd);
        }
    } else if let Some(g) = eat(&mut buf, &REPEAT_ON_WEEKDAYS_RE) {
        if let Some(wd) = weekday_from(&g, 1) {
            repeat = Some(RepeatRule::WeeklyOn { weekday: wd, n: 1 });
            repeat_weekday = Some(wd);
        }
    }

    // 4. Date words, in priority order (first match wins).
    let mut delta: Option<i64> = None;
    let mut is_tonight = false;
    let mut is_end_of_day = false;
    // A "this morning" / "first thing" style default-time hint, applied only
    // once we know a date was actually resolved.
    let mut day_part_hint: Option<String> = None;
    let mut ordinal_day_of_month: Option<u32> = None;
    let mut someday = false;

    // "N units from now/today" is checked first: it embeds the word "today",
    // which the plain TODAY_RE below would otherwise snatch on its own.
    if let Some(g) = eat(&mut buf, &QTY_FROM_NOW_RE) {
        let n = qty_from(&g, 1) as i64;
        let unit = g[2].as_deref().unwrap_or("days");
        delta = Some(if unit.starts_with("week") {
            n * 7
        } else if unit.starts_with("month") {
            days_between(today, today.add_months(n))
        } else {
            n
        });
    } else if eat(&mut buf, &TONIGHT_RE).is_some() {
        delta = Some(0);
        is_tonight = true;
    } else if let Some(g) = eat(&mut buf, &THIS_DAY_PART_RE) {
        delta = Some(0);
        day_part_hint = g[1].clone();
    } else if eat(&mut buf, &LATER_TODAY_RE).is_some() {
        delta = Some(0);
    } else if eat(&mut buf, &END_OF_DAY_RE).is_some() {
        delta = Some(0);
        is_end_of_day = true;
    } else if eat(&mut buf, &TODAY_RE).is_some() {
        delta = Some(0);
    } else if eat(&mut buf, &YESTERDAY_RE).is_some() {
        delta = Some(-1);
    } else if eat(&mut buf, &DAY_AFTER_TOMORROW_RE).is_some() {
        delta = Some(2);
    } else if eat(&mut buf, &TOMORROW_RE).is_some() {
        delta = Some(1);
    } else if eat(&mut buf, &IN_A_FORTNIGHT_RE).is_some() {
        delta = Some(14);
    } else if let Some(g) = eat(&mut buf, &IN_N_DAYS_RE) {
        delta = Some(qty_from(&g, 1) as i64);
    } else if let Some(g) = eat(&mut buf, &IN_N_WEEKS_RE) {
        delta = Some(qty_from(&g, 1) as i64 * 7);
    } else if let Some(g) = eat(&mut buf, &IN_N_MONTHS_RE) {
        let target = today.add_months(qty_from(&g, 1) as i64);
        delta = Some(days_between(today, target));
    } else if let Some(g) = eat(&mut buf, &IN_N_YEARS_RE) {
        let target = today.add_months(qty_from(&g, 1) as i64 * 12);
        delta = Some(days_between(today, target));
    } else if eat(&mut buf, &WEEK_AFTER_NEXT_RE).is_some() {
        delta = Some(14);
    } else if eat(&mut buf, &NEXT_WEEK_RE).is_some() {
        delta = Some(7);
    } else if eat(&mut buf, &NEXT_WEEKEND_RE).is_some() {
        delta = Some(nearest_weekday_delta(today_wd, 6) + 7);
    } else if eat(&mut buf, &THIS_WEEKEND_RE).is_some() {
        delta = Some(if today_wd == 6 { 0 } else { nearest_weekday_delta(today_wd, 6) });
    } else if eat(&mut buf, &START_OF_WEEK_RE).is_some() {
        // The coming Monday (today if it's already Monday feels wrong for
        // "start of the week", so a Monday-today rolls to next week).
        delta = Some(nearest_weekday_delta(today_wd, 1));
    } else if eat(&mut buf, &END_OF_WEEK_RE).is_some() {
        let raw = (5 - today_wd as i64).rem_euclid(7);
        delta = Some(if raw == 0 { 7 } else { raw });
    } else if eat(&mut buf, &MID_WEEK_RE).is_some() {
        delta = Some(nearest_weekday_delta(today_wd, 3));
    } else if eat(&mut buf, &END_OF_MONTH_RE).is_some() {
        let mut target = SimpleDate::new(today.y, today.m, today.days_in_month());
        if target == today {
            target = today.add_months(1);
            target = SimpleDate::new(target.y, target.m, target.days_in_month());
        }
        delta = Some(days_between(today, target));
    } else if eat(&mut buf, &END_OF_YEAR_RE).is_some() {
        let mut target = SimpleDate::new(today.y, 12, 31);
        if target == today {
            target = SimpleDate::new(today.y + 1, 12, 31);
        }
        delta = Some(days_between(today, target));
    } else if eat(&mut buf, &BEGINNING_OF_MONTH_RE).is_some() {
        let target = today.add_months(1);
        delta = Some(days_between(today, SimpleDate::new(target.y, target.m, 1)));
    } else if eat(&mut buf, &MID_MONTH_RE).is_some() {
        delta = Some(resolve_ordinal_day(today, 15));
    } else if eat(&mut buf, &NEXT_MONTH_RE).is_some() {
        delta = Some(days_between(today, today.add_months(1)));
    } else if eat(&mut buf, &NEXT_YEAR_RE).is_some() {
        delta = Some(days_between(today, SimpleDate::new(today.y + 1, today.m, today.d)));
    } else if let Some(g) = eat(&mut buf, &NEXT_WEEKDAY_RE) {
        if let Some(wd) = weekday_from(&g, 1) {
            delta = Some(next_weekday_delta(today_wd, wd));
        }
    } else if let Some(g) = eat(&mut buf, &LAST_WEEKDAY_RE) {
        if let Some(wd) = weekday_from(&g, 1) {
            // Most recent past occurrence (a negative delta -> overdue).
            let back = (today_wd as i64 - wd as i64).rem_euclid(7);
            delta = Some(-(if back == 0 { 7 } else { back }));
        }
    } else if let Some(g) = eat(&mut buf, &THIS_OR_BARE_WEEKDAY_RE) {
        if let Some(wd) = weekday_from(&g, 1) {
            delta = Some(nearest_weekday_delta(today_wd, wd));
        }
    } else if let Some(g) = eat(&mut buf, &MONTH_DAY_RE) {
        if let Some(month) = g[1].as_deref().and_then(month_from_name) {
            let day: u32 = g[2].as_ref().unwrap().parse().unwrap_or(1);
            delta = Some(resolve_month_day(today, month, day));
        }
    } else if let Some(g) = eat(&mut buf, &DAY_MONTH_RE) {
        if let Some(month) = g[2].as_deref().and_then(month_from_name) {
            let day: u32 = g[1].as_ref().unwrap().parse().unwrap_or(1);
            delta = Some(resolve_month_day(today, month, day));
        }
    } else if let Some(g) = eat(&mut buf, &NUMERIC_DATE_RE) {
        let month: u32 = g[1].as_ref().unwrap().parse().unwrap_or(1);
        let day: u32 = g[2].as_ref().unwrap().parse().unwrap_or(1);
        if (1..=12).contains(&month) && (1..=31).contains(&day) {
            if let Some(year_raw) = g.get(3).and_then(|y| y.as_ref()) {
                let year: i32 = if year_raw.len() <= 2 {
                    2000 + year_raw.parse::<i32>().unwrap_or(0)
                } else {
                    year_raw.parse().unwrap_or(today.y)
                };
                delta = Some(days_between(today, SimpleDate::new(year, month, day)));
            } else {
                delta = Some(resolve_month_day(today, month, day));
            }
        }
    } else if let Some(g) = eat(&mut buf, &BARE_ORDINAL_RE) {
        let day: u32 = g[1].as_ref().unwrap().parse().unwrap_or(1);
        if (1..=31).contains(&day) {
            ordinal_day_of_month = Some(day);
            delta = Some(resolve_ordinal_day(today, day));
        }
    } else if let Some(g) = eat(&mut buf, &PREP_MONTH_RE) {
        // "in March" / "next April" -> the 1st of that month, next occurrence.
        if let Some(month) = g[1].as_deref().and_then(month_from_name) {
            delta = Some(resolve_month_day(today, month, 1));
        }
    } else if eat(&mut buf, &SOMEDAY_RE).is_some() {
        someday = true;
    }

    if delta.is_none() {
        if let Some((week, wd)) = monthly_dow {
            delta = Some(next_monthly_dow_delta(today, week, wd));
        } else if let Some(wd) = repeat_weekday {
            delta = Some(nearest_weekday_delta(today_wd, wd));
        } else if due_time.is_some() {
            delta = Some(0);
        }
    }

    // A day-part word ("tomorrow morning") only sets a default time when a
    // date was actually resolved — otherwise a title like "Plan my morning
    // routine" would incorrectly get stripped and dated.
    if due_time.is_none() && delta.is_some() {
        if is_tonight {
            due_time = Some("20:00".to_string());
        } else if is_end_of_day {
            due_time = Some("17:00".to_string());
        } else if let Some(word) = &day_part_hint {
            due_time = Some(day_part_time(word));
        } else if eat(&mut buf, &FIRST_THING_RE).is_some() {
            due_time = Some("09:00".to_string());
        } else if let Some(g) = eat(&mut buf, &DAY_PART_RE) {
            due_time = Some(day_part_time(&g[0].as_deref().unwrap_or("")));
        }
    }

    if let Some(RepeatRule::Monthly { day_of_month, .. }) = &mut repeat {
        if day_of_month.is_none() {
            if let Some(d) = ordinal_day_of_month {
                *day_of_month = Some(d);
            }
        }
    }

    // 5. Explicit list assignment: "for design", "@product", "in personal".
    let mut list: Option<String> = if someday && input.known_list_ids.iter().any(|l| l == "someday") {
        Some("someday".to_string())
    } else {
        None
    };
    if !input.known_list_ids.is_empty() {
        let alts = input
            .known_list_ids
            .iter()
            .map(|id| regex::escape(id))
            .collect::<Vec<_>>()
            .join("|");
        // `\s` rather than `\b` before the alternation — `\b` never matches
        // immediately before `@` when preceded by whitespace (both sides are
        // non-word chars), and the buffer is always space-padded anyway. The
        // trailing space lives inside "for "/"in " (not "@") since "@product"
        // is written with no space between the sigil and the list name.
        if let Ok(list_re) = Regex::new(&format!(r"\s(?:for |in |@)({alts})\b")) {
            if let Some(g) = eat(&mut buf, &list_re) {
                if list.is_none() {
                    list = g[1].clone();
                }
            }
        }
    }

    // 6. #tags — repeated; a tag matching a known list id sets the list
    // instead of becoming a tag.
    let mut tags: Vec<String> = Vec::new();
    while let Some(g) = eat(&mut buf, &TAG_RE) {
        let raw = g[0].as_deref().unwrap_or("");
        let name = raw.trim_start_matches('#').to_string();
        if input.known_list_ids.iter().any(|id| id == &name) {
            if list.is_none() {
                list = Some(name);
            }
        } else {
            tags.push(name);
        }
    }

    // 7. Whatever's left becomes the title.
    let mut title = buf.keep.split_whitespace().collect::<Vec<_>>().join(" ");
    loop {
        let replaced = TRAILING_CONNECTOR_RE.replace(&title, "").to_string();
        if replaced == title {
            break;
        }
        title = replaced.trim().to_string();
    }
    if let Some(first) = title.get(0..1) {
        title = format!("{}{}", first.to_uppercase(), &title[1..]);
    }

    let group_hint = if someday { Group::Later } else { Group::Today };
    let (due_date, label, group, dated) = match delta {
        Some(d) => {
            let target = today.add_days(d);
            let label = if d == 0 {
                "Today".to_string()
            } else if d == 1 {
                "Tomorrow".to_string()
            } else if d == -1 {
                "Yesterday".to_string()
            } else {
                format!("{} {} {}", WEEKDAY_SHORT[target.weekday() as usize], MONTH_SHORT[(target.m - 1) as usize], target.d)
            };
            // A past date ("yesterday", "last Friday") is overdue, so it belongs
            // in the same rolled-up bucket as Today.
            let group = if d <= 0 { Group::Today } else if d <= 7 { Group::Upcoming } else { Group::Next };
            (Some(target.to_iso()), label, group, true)
        }
        None => (None, String::new(), group_hint, false),
    };

    ParsedCapture {
        title,
        list_id: list.clone().unwrap_or_else(|| "inbox".to_string()),
        list_given: list.is_some(),
        priority,
        tags,
        due_date,
        due_time,
        label,
        repeat,
        group,
        dated,
    }
}

fn day_part_time(word: &str) -> String {
    match word {
        "morning" => "09:00",
        "afternoon" => "14:00",
        "evening" => "18:00",
        "night" => "20:00",
        _ => "09:00",
    }
    .to_string()
}

/// Maps an in-month ordinal word/digit ("first", "3rd", "last") to a week
/// index: 1..=5, or -1 for "last".
fn week_from_ordinal(s: &str) -> Option<i32> {
    match s {
        "first" | "1st" => Some(1),
        "second" | "2nd" => Some(2),
        "third" | "3rd" => Some(3),
        "fourth" | "4th" => Some(4),
        "fifth" | "5th" => Some(5),
        "last" => Some(-1),
        _ => None,
    }
}

/// Day-delta to the next occurrence of "the `week`-th `weekday` of the month",
/// staying in the current month when that day hasn't passed yet, else rolling
/// into next month.
fn next_monthly_dow_delta(today: SimpleDate, week: i32, weekday: u32) -> i64 {
    let this = SimpleDate::new(today.y, today.m, nth_weekday_of_month(today.y, today.m, week, weekday));
    let target = if this.ordinal() >= today.ordinal() {
        this
    } else {
        let nm = today.add_months(1);
        SimpleDate::new(nm.y, nm.m, nth_weekday_of_month(nm.y, nm.m, week, weekday))
    };
    days_between(today, target)
}

/// Resolves a literal month+day mention to a day-delta from `today`,
/// rolling into next year if that month/day has already passed this year.
fn resolve_month_day(today: SimpleDate, month: u32, day: u32) -> i64 {
    let mut year = today.y;
    let mut target = SimpleDate::new(year, month, day.min(crate::calendar::days_in_month(year, month)));
    if target.ordinal() < today.ordinal() {
        year += 1;
        target = SimpleDate::new(year, month, day.min(crate::calendar::days_in_month(year, month)));
    }
    days_between(today, target)
}

/// Resolves a bare ordinal day ("the 15th") to a day-delta, rolling into next
/// month (with real month/year rollover) if that day has already passed.
fn resolve_ordinal_day(today: SimpleDate, day: u32) -> i64 {
    let this_month_days = today.days_in_month();
    let target = if day >= today.d && day <= this_month_days {
        SimpleDate::new(today.y, today.m, day)
    } else {
        let next = today.add_months(1);
        let clamped = day.min(crate::calendar::days_in_month(next.y, next.m));
        SimpleDate::new(next.y, next.m, clamped)
    };
    days_between(today, target)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn parse_on(today: (i32, u32, u32), text: &str) -> ParsedCapture {
        let known = vec!["inbox", "product", "design", "personal", "someday"]
            .into_iter()
            .map(String::from)
            .collect::<Vec<_>>();
        parse(ParseInput { text, today: SimpleDate::new(today.0, today.1, today.2), known_list_ids: &known })
    }

    // Thursday 2026-07-30, matching the source mockup's fixed demo date.
    const BASE: (i32, u32, u32) = (2026, 7, 30);

    #[test]
    fn mockup_example_cancel_subscription_tomorrow() {
        let p = parse_on(BASE, "Cancel Claude subscription tomorrow");
        assert_eq!(p.title, "Cancel Claude subscription");
        assert_eq!(p.due_date.as_deref(), Some("2026-07-31"));
        assert_eq!(p.label, "Tomorrow");
        assert_eq!(p.list_id, "inbox");
    }

    #[test]
    fn mockup_example_book_car_next_tuesday() {
        let p = parse_on(BASE, "Book car in for maintenance next Tuesday");
        // BASE is a Thursday; nearest Tuesday is 5 days out, "next Tuesday" adds a week -> 12.
        assert_eq!(p.due_date.as_deref(), Some("2026-08-11"));
        assert!(p.title.to_lowercase().contains("book car"));
    }

    #[test]
    fn mockup_example_invoice_every_month() {
        let p = parse_on(BASE, "Send invoice on the 15th of every month");
        assert_eq!(p.due_date.as_deref(), Some("2026-08-15"));
        match p.repeat {
            Some(RepeatRule::Monthly { n: 1, day_of_month: Some(15) }) => {}
            other => panic!("unexpected repeat: {other:?}"),
        }
        assert_eq!(p.title, "Send invoice");
    }

    #[test]
    fn mockup_example_standup_every_weekday() {
        let p = parse_on(BASE, "Standup every weekday 9am #product");
        assert_eq!(p.due_time.as_deref(), Some("09:00"));
        assert!(matches!(p.repeat, Some(RepeatRule::Weekday)));
        assert_eq!(p.list_id, "product");
        assert_eq!(p.title, "Standup");
    }

    #[test]
    fn mockup_example_renew_passport() {
        let p = parse_on(BASE, "Renew passport in 10 days !!");
        assert_eq!(p.due_date.as_deref(), Some("2026-08-09"));
        assert!(matches!(p.priority, Priority::High));
        assert_eq!(p.title, "Renew passport");
    }

    #[test]
    fn each_month_matches_same_as_every_month() {
        let a = parse_on(BASE, "Pay rent every month");
        let b = parse_on(BASE, "Pay rent each month");
        assert_eq!(a.repeat, b.repeat);
        assert!(matches!(a.repeat, Some(RepeatRule::Monthly { n: 1, day_of_month: None })));
    }

    #[test]
    fn each_week_and_each_year_synonyms() {
        let w = parse_on(BASE, "Water plants each week");
        assert!(matches!(w.repeat, Some(RepeatRule::Weekly { n: 1 })));
        let y = parse_on(BASE, "Renew license each year");
        assert!(matches!(y.repeat, Some(RepeatRule::Yearly { n: 1 })));
    }

    #[test]
    fn digit_vs_word_quantities_agree() {
        let a = parse_on(BASE, "Water plants every 2 weeks");
        let b = parse_on(BASE, "Water plants every two weeks");
        assert_eq!(a.repeat, b.repeat);
        assert!(matches!(a.repeat, Some(RepeatRule::Weekly { n: 2 })));
    }

    #[test]
    fn biweekly_and_fortnightly_are_every_other_week() {
        let a = parse_on(BASE, "Team sync biweekly");
        let b = parse_on(BASE, "Team sync fortnightly");
        assert_eq!(a.repeat, Some(RepeatRule::Weekly { n: 2 }));
        assert_eq!(b.repeat, Some(RepeatRule::Weekly { n: 2 }));
    }

    #[test]
    fn quarterly_is_every_3_months() {
        let p = parse_on(BASE, "Review budget quarterly");
        assert_eq!(p.repeat, Some(RepeatRule::Monthly { n: 3, day_of_month: None }));
    }

    #[test]
    fn this_friday_vs_next_friday() {
        // BASE (Thu 2026-07-30): nearest Friday is tomorrow (2026-07-31).
        let this_one = parse_on(BASE, "Lunch this friday");
        assert_eq!(this_one.due_date.as_deref(), Some("2026-07-31"));
        let bare = parse_on(BASE, "Lunch friday");
        assert_eq!(bare.due_date.as_deref(), Some("2026-07-31"));
        // "next Friday" should skip a full week further out.
        let next_one = parse_on(BASE, "Lunch next friday");
        assert_eq!(next_one.due_date.as_deref(), Some("2026-08-07"));
    }

    #[test]
    fn next_on_todays_own_weekday_means_next_week_not_two_weeks() {
        // BASE is itself a Thursday.
        let p = parse_on(BASE, "Standup next thursday");
        assert_eq!(p.due_date.as_deref(), Some("2026-08-06"));
    }

    #[test]
    fn bare_day_part_time_defaults_sensibly() {
        let p = parse_on(BASE, "Call mom tomorrow morning");
        assert_eq!(p.due_time.as_deref(), Some("09:00"));
        assert_eq!(p.title, "Call mom");
    }

    #[test]
    fn day_part_word_alone_does_not_invent_a_date() {
        let p = parse_on(BASE, "Plan my morning routine");
        assert!(!p.dated);
        assert_eq!(p.due_time, None);
        assert_eq!(p.title, "Plan my morning routine");
    }

    #[test]
    fn tonight_defaults_to_evening() {
        let p = parse_on(BASE, "Watch the game tonight");
        assert_eq!(p.due_date.as_deref(), Some("2026-07-30"));
        assert_eq!(p.due_time.as_deref(), Some("20:00"));
    }

    #[test]
    fn ordinal_month_rollover_across_year_boundary() {
        let p = parse_on((2026, 12, 31), "File taxes on the 2nd");
        assert_eq!(p.due_date.as_deref(), Some("2027-01-02"));
    }

    #[test]
    fn month_day_literal_any_month_rolls_to_next_year() {
        // Asking for "March 1" while already past March this year should
        // roll to next year.
        let p = parse_on((2026, 11, 3), "Taxes due march 1");
        assert_eq!(p.due_date.as_deref(), Some("2027-03-01"));
        let p2 = parse_on((2026, 1, 3), "Taxes due march 1");
        assert_eq!(p2.due_date.as_deref(), Some("2026-03-01"));
    }

    #[test]
    fn day_of_month_of_month_form() {
        let p = parse_on(BASE, "Rent due on the 1st of December");
        assert_eq!(p.due_date.as_deref(), Some("2026-12-01"));
    }

    #[test]
    fn priority_synonyms() {
        assert!(matches!(parse_on(BASE, "Ship it asap").priority, Priority::High));
        assert!(matches!(parse_on(BASE, "Ship it urgent").priority, Priority::High));
        assert!(matches!(parse_on(BASE, "Ship it critical").priority, Priority::High));
        assert!(matches!(parse_on(BASE, "Ship it high priority").priority, Priority::High));
        assert!(matches!(parse_on(BASE, "Ship it important").priority, Priority::Med));
        assert!(matches!(parse_on(BASE, "Ship it !").priority, Priority::Med));
        assert!(matches!(parse_on(BASE, "Ship it").priority, Priority::Low));
    }

    #[test]
    fn saturday_and_all_weekday_abbreviations_resolve() {
        // BASE is Thursday 2026-07-30 -- Saturday is 2 days out.
        assert_eq!(parse_on(BASE, "Party saturday").due_date.as_deref(), Some("2026-08-01"));
        assert_eq!(parse_on(BASE, "Party sat").due_date.as_deref(), Some("2026-08-01"));
        for (word, expected_wd) in [
            ("sunday", 0), ("monday", 1), ("tuesday", 2), ("wednesday", 3),
            ("thursday", 4), ("friday", 5), ("saturday", 6),
        ] {
            let p = parse_on(BASE, &format!("Thing on {word}"));
            let d = crate::calendar::SimpleDate::new(2026, 7, 30);
            assert_eq!(
                p.due_date,
                Some(d.add_days(crate::calendar::nearest_weekday_delta(d.weekday(), expected_wd)).to_iso()),
                "weekday word {word}"
            );
        }
    }

    #[test]
    fn every_saturday_recurrence() {
        let p = parse_on(BASE, "Long run every saturday");
        assert_eq!(p.repeat, Some(RepeatRule::WeeklyOn { weekday: 6, n: 1 }));
    }

    #[test]
    fn once_a_period_synonyms() {
        assert!(matches!(parse_on(BASE, "Standup once a day").repeat, Some(RepeatRule::Daily { n: 1 })));
        assert!(matches!(parse_on(BASE, "Groceries once a week").repeat, Some(RepeatRule::Weekly { n: 1 })));
        assert!(matches!(
            parse_on(BASE, "Pay rent once a month").repeat,
            Some(RepeatRule::Monthly { n: 1, day_of_month: None })
        ));
        assert!(matches!(parse_on(BASE, "Renew domain once a year").repeat, Some(RepeatRule::Yearly { n: 1 })));
    }

    #[test]
    fn once_a_fortnight_is_every_other_week() {
        assert_eq!(parse_on(BASE, "Bins out once a fortnight").repeat, Some(RepeatRule::Weekly { n: 2 }));
        assert_eq!(parse_on(BASE, "Bins out every fortnight").repeat, Some(RepeatRule::Weekly { n: 2 }));
    }

    #[test]
    fn every_other_weekday_is_biweekly_on_that_day() {
        let p = parse_on(BASE, "Therapy every other thursday");
        assert_eq!(p.repeat, Some(RepeatRule::WeeklyOn { weekday: 4, n: 2 }));
        // Seeds the due date to the nearest Thursday (BASE is itself a Thursday
        // -> next one, a week out).
        assert_eq!(p.due_date.as_deref(), Some("2026-08-06"));
    }

    #[test]
    fn every_n_weekday_and_every_n_weeks_on_weekday() {
        assert_eq!(
            parse_on(BASE, "Sprint demo every 3 fridays").repeat,
            Some(RepeatRule::WeeklyOn { weekday: 5, n: 3 })
        );
        assert_eq!(
            parse_on(BASE, "Sprint demo every 2 weeks on friday").repeat,
            Some(RepeatRule::WeeklyOn { weekday: 5, n: 2 })
        );
    }

    #[test]
    fn nth_weekday_of_month_forms() {
        // BASE is Thursday 2026-07-30. The first Thursday of August 2026 is the
        // 6th; July's first Thursday (the 2nd) has already passed.
        let p = parse_on(BASE, "Board meeting the first thursday of every month");
        assert_eq!(p.repeat, Some(RepeatRule::MonthlyDow { n: 1, week: 1, weekday: 4 }));
        assert_eq!(p.due_date.as_deref(), Some("2026-08-06"));
        assert_eq!(p.title, "Board meeting");
    }

    #[test]
    fn last_weekday_of_month_and_digit_ordinal() {
        // Last Friday of July 2026 is the 31st (still upcoming from the 30th).
        let p = parse_on(BASE, "Payroll on the last friday of the month");
        assert_eq!(p.repeat, Some(RepeatRule::MonthlyDow { n: 1, week: -1, weekday: 5 }));
        assert_eq!(p.due_date.as_deref(), Some("2026-07-31"));

        let d = parse_on(BASE, "Rent 2nd tuesday of each month");
        assert_eq!(d.repeat, Some(RepeatRule::MonthlyDow { n: 1, week: 2, weekday: 2 }));
    }

    #[test]
    fn monthly_with_day_of_month_either_order() {
        let a = parse_on(BASE, "Send invoice on the 15th of every month");
        let b = parse_on(BASE, "Send invoice every month on the 15th");
        assert_eq!(a.repeat, Some(RepeatRule::Monthly { n: 1, day_of_month: Some(15) }));
        assert_eq!(a.repeat, b.repeat);
    }

    #[test]
    fn every_n_years() {
        assert_eq!(parse_on(BASE, "Renew passport every 10 years").repeat, Some(RepeatRule::Yearly { n: 10 }));
    }

    #[test]
    fn quarterly_and_semiannual_synonyms() {
        assert_eq!(parse_on(BASE, "Review budget every quarter").repeat, Some(RepeatRule::Monthly { n: 3, day_of_month: None }));
        assert_eq!(parse_on(BASE, "Dentist twice a year").repeat, Some(RepeatRule::Monthly { n: 6, day_of_month: None }));
        assert_eq!(parse_on(BASE, "Audit semi-annually").repeat, Some(RepeatRule::Monthly { n: 6, day_of_month: None }));
    }

    #[test]
    fn list_assignment_via_for_at_in() {
        assert_eq!(parse_on(BASE, "Fix bug for design").list_id, "design");
        assert_eq!(parse_on(BASE, "Fix bug @product").list_id, "product");
        assert_eq!(parse_on(BASE, "Fix bug in personal").list_id, "personal");
    }

    #[test]
    fn tags_extracted_and_known_list_tag_sets_list_instead() {
        let p = parse_on(BASE, "Polish onboarding #ux #product");
        assert_eq!(p.tags, vec!["ux".to_string()]);
        assert_eq!(p.list_id, "product");
        assert!(p.list_given);
    }

    #[test]
    fn someday_sets_later_group_and_list() {
        let p = parse_on(BASE, "Learn to sail someday");
        assert!(!p.dated);
        assert!(matches!(p.group, Group::Later));
        assert_eq!(p.list_id, "someday");
    }

    #[test]
    fn in_n_days_and_weeks_and_months_word_and_digit() {
        assert_eq!(parse_on(BASE, "Renew passport in 10 days").due_date.as_deref(), Some("2026-08-09"));
        assert_eq!(parse_on(BASE, "Renew passport in ten days").due_date.as_deref(), Some("2026-08-09"));
        assert_eq!(parse_on(BASE, "Follow up in 2 weeks").due_date.as_deref(), Some("2026-08-13"));
        assert_eq!(parse_on(BASE, "Follow up in two weeks").due_date.as_deref(), Some("2026-08-13"));
        assert_eq!(parse_on(BASE, "Check back in 1 month").due_date.as_deref(), Some("2026-08-30"));
    }

    #[test]
    fn numeric_date_with_and_without_year() {
        assert_eq!(parse_on(BASE, "Renew 12/25").due_date.as_deref(), Some("2026-12-25"));
        assert_eq!(parse_on(BASE, "Renew 3/4/2027").due_date.as_deref(), Some("2027-03-04"));
    }

    #[test]
    fn vague_quantities_in_relative_dates() {
        // BASE = Thu 2026-07-30.
        assert_eq!(parse_on(BASE, "Ping her in a few days").due_date.as_deref(), Some("2026-08-02"));
        assert_eq!(parse_on(BASE, "Follow up in a couple of weeks").due_date.as_deref(), Some("2026-08-13"));
        assert_eq!(parse_on(BASE, "Check back in a week").due_date.as_deref(), Some("2026-08-06"));
        assert_eq!(parse_on(BASE, "Renew in a month").due_date.as_deref(), Some("2026-08-30"));
        assert_eq!(parse_on(BASE, "Reassess in a couple months").due_date.as_deref(), Some("2026-09-30"));
    }

    #[test]
    fn in_a_year_and_years() {
        assert_eq!(parse_on(BASE, "Renew domain in a year").due_date.as_deref(), Some("2027-07-30"));
        assert_eq!(parse_on(BASE, "Replace laptop in 3 years").due_date.as_deref(), Some("2029-07-30"));
    }

    #[test]
    fn fortnight_and_from_now_units() {
        assert_eq!(parse_on(BASE, "Pay invoice in a fortnight").due_date.as_deref(), Some("2026-08-13"));
        assert_eq!(parse_on(BASE, "Review a week from now").due_date.as_deref(), Some("2026-08-06"));
        assert_eq!(parse_on(BASE, "Review two weeks from today").due_date.as_deref(), Some("2026-08-13"));
        assert_eq!(parse_on(BASE, "Report a month from now").due_date.as_deref(), Some("2026-08-30"));
    }

    #[test]
    fn yesterday_and_last_weekday_are_overdue() {
        let y = parse_on(BASE, "Log yesterday's hours");
        assert_eq!(y.due_date.as_deref(), Some("2026-07-29"));
        assert_eq!(y.label, "Yesterday");
        assert!(matches!(y.group, Group::Today));
        // BASE is Thursday; last Tuesday was two days back.
        let t = parse_on(BASE, "Backfill notes from last tuesday");
        assert_eq!(t.due_date.as_deref(), Some("2026-07-28"));
    }

    #[test]
    fn coming_weekday_and_week_after_next() {
        assert_eq!(parse_on(BASE, "Dentist this coming monday").due_date.as_deref(), Some("2026-08-03"));
        assert_eq!(parse_on(BASE, "Dentist coming monday").due_date.as_deref(), Some("2026-08-03"));
        // "the week after next" is a flat two weeks out.
        assert_eq!(parse_on(BASE, "Trip the week after next").due_date.as_deref(), Some("2026-08-13"));
    }

    #[test]
    fn start_mid_end_of_week_and_month() {
        // Coming Monday from Thu 2026-07-30 is Aug 3.
        assert_eq!(parse_on(BASE, "Kickoff start of the week").due_date.as_deref(), Some("2026-08-03"));
        // Midweek -> the coming Wednesday, Aug 5.
        assert_eq!(parse_on(BASE, "Sync midweek").due_date.as_deref(), Some("2026-08-05"));
        // "first of the month" -> next 1st, Aug 1.
        assert_eq!(parse_on(BASE, "Rent first of the month").due_date.as_deref(), Some("2026-08-01"));
        // Mid-month -> the 15th (upcoming), Aug 15.
        assert_eq!(parse_on(BASE, "Bill mid-month").due_date.as_deref(), Some("2026-08-15"));
    }

    #[test]
    fn eod_eow_eom_abbreviations() {
        let eod = parse_on(BASE, "Wrap up report eod");
        assert_eq!(eod.due_date.as_deref(), Some("2026-07-30"));
        assert_eq!(eod.due_time.as_deref(), Some("17:00"));
        // eow -> Friday 2026-07-31; eom -> 2026-07-31 (last day of July).
        assert_eq!(parse_on(BASE, "Ship eow").due_date.as_deref(), Some("2026-07-31"));
        assert_eq!(parse_on(BASE, "Invoice eom").due_date.as_deref(), Some("2026-07-31"));
    }

    #[test]
    fn prepositioned_bare_month() {
        // "in September" -> Sep 1 2026 (upcoming).
        assert_eq!(parse_on(BASE, "Conference in september").due_date.as_deref(), Some("2026-09-01"));
        // "next March" -> Mar 1 2027 (rolls past July).
        assert_eq!(parse_on(BASE, "Taxes next march").due_date.as_deref(), Some("2027-03-01"));
        // A month name with a day still parses as that exact day, not the 1st.
        assert_eq!(parse_on(BASE, "Trip in september 12").due_date.as_deref(), Some("2026-09-12"));
    }

    #[test]
    fn colloquial_times() {
        assert_eq!(parse_on(BASE, "Lunch with Sam today at lunch").due_time.as_deref(), Some("12:00"));
        assert_eq!(parse_on(BASE, "Standup tomorrow midday").due_time.as_deref(), Some("12:00"));
        let ft = parse_on(BASE, "Gym first thing tomorrow");
        assert_eq!(ft.due_time.as_deref(), Some("09:00"));
        assert_eq!(ft.title, "Gym");
        let tm = parse_on(BASE, "Reply to Alex this morning");
        assert_eq!(tm.due_date.as_deref(), Some("2026-07-30"));
        assert_eq!(tm.due_time.as_deref(), Some("09:00"));
        assert_eq!(tm.title, "Reply to Alex");
    }

    #[test]
    fn priority_shorthands() {
        assert!(matches!(parse_on(BASE, "Fix login p1").priority, Priority::High));
        assert!(matches!(parse_on(BASE, "Fix login top priority").priority, Priority::High));
        assert!(matches!(parse_on(BASE, "Polish copy p2").priority, Priority::Med));
        assert!(matches!(parse_on(BASE, "Tidy desk no rush").priority, Priority::Low));
    }

    #[test]
    fn day_part_word_alone_still_does_not_invent_a_date() {
        // Regression guard: the new "this morning" branch must not fire on a
        // bare "morning" used as a plain noun.
        let p = parse_on(BASE, "Plan my morning routine");
        assert!(!p.dated);
        assert_eq!(p.due_time, None);
        assert_eq!(p.title, "Plan my morning routine");
    }

    #[test]
    fn no_date_means_not_dated() {
        let p = parse_on(BASE, "Write the retro notes");
        assert!(!p.dated);
        assert_eq!(p.due_date, None);
        assert_eq!(p.title, "Write the retro notes");
    }
}
