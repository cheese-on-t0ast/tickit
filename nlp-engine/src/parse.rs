use crate::calendar::{
    days_between, month_from_name, nearest_weekday_delta, next_weekday_delta, weekday_from_abbrev3,
    word_to_num, SimpleDate, MONTH_SHORT, WEEKDAY_SHORT,
};
use crate::model::{Group, ParsedCapture, Priority, RepeatRule};
use regex::Regex;
use std::sync::LazyLock;

/// Number word or digit, 1..12 — e.g. "3" or "three".
const NUM: &str = r"(\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)";
/// Irregular weekday short forms, longest alternative first so e.g.
/// "saturday" doesn't get stuck matching just "sat" and dead-ending before
/// the trailing "urday". First 3 chars of whatever matched always map
/// cleanly via `weekday_from_abbrev3` (tue -> tuesday, wed -> wednesday, etc).
const WD: &str = r"(wednes|thurs|thur|tues|satur|mon|tue|wed|thu|fri|sat|sun)";
/// Same longest-first reasoning for month names/abbreviations.
const MON: &str = r"(january|february|march|april|august|september|october|november|december|june|july|sept|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)";

macro_rules! re {
    ($name:ident, $pat:expr) => {
        static $name: LazyLock<Regex> = LazyLock::new(|| Regex::new($pat).unwrap());
    };
}

re!(HIGH_PRIO_RE, r"!!!|!!|\burgent\b|\basap\b|\bcritical\b|\bhigh priority\b");
re!(MED_PRIO_RE, r"\bimportant\b|\bmedium priority\b|\s!\s");
re!(LOW_PRIO_RE, r"\blow priority\b");

re!(CLOCK_TIME_RE, r"\b(\d{1,2})(?::(\d{2}))?\s?(am|pm)\b");
re!(NOON_RE, r"\bnoon\b");
re!(MIDNIGHT_RE, r"\bmidnight\b");
re!(DAY_PART_RE, r"\bmorning\b|\bafternoon\b|\bevening\b|\bnight\b");

re!(REPEAT_WEEKDAY_KIND_RE, r"\b(?:every|each) weekday\b|\bon weekdays\b|\bweekdays\b");
re!(REPEAT_OTHER_WEEK_RE, r"\b(?:every|each) other week\b|\bbiweekly\b|\bfortnightly\b");
static REPEAT_N_WEEKS_RE: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(&format!(r"\b(?:every|each) {NUM} weeks\b")).unwrap());
re!(REPEAT_WEEK_RE, r"\b(?:every|each) week\b|\bweekly\b");
re!(REPEAT_QUARTERLY_RE, r"\bquarterly\b");
static REPEAT_N_MONTHS_RE: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(&format!(r"\b(?:every|each) {NUM} months\b")).unwrap());
re!(REPEAT_MONTH_RE, r"\b(?:every|each) month\b|\bmonthly\b");
static REPEAT_N_DAYS_RE: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(&format!(r"\b(?:every|each) {NUM} days\b")).unwrap());
re!(REPEAT_DAY_RE, r"\b(?:every|each) day\b|\bdaily\b");
re!(REPEAT_YEAR_RE, r"\b(?:every|each) year\b|\byearly\b|\bannually\b");
static REPEAT_WEEKDAY_NAME_RE: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(&format!(r"\b(?:every|each) {WD}(?:day)?s?\b")).unwrap());
static REPEAT_ON_WEEKDAYS_RE: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(&format!(r"\bon {WD}(?:day)?s\b")).unwrap());

re!(TONIGHT_RE, r"\btonight\b");
re!(TODAY_RE, r"\btoday\b");
re!(DAY_AFTER_TOMORROW_RE, r"\bday after tomorrow\b");
re!(TOMORROW_RE, r"\btomorrow\b|\btmrw\b|\btmr\b");
static IN_N_DAYS_RE: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(&format!(r"\bin {NUM} days?\b")).unwrap());
static IN_N_WEEKS_RE: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(&format!(r"\bin {NUM} weeks?\b")).unwrap());
static IN_N_MONTHS_RE: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(&format!(r"\bin {NUM} months?\b")).unwrap());
static N_DAYS_FROM_NOW_RE: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(&format!(r"\b{NUM} days? from (?:now|today)\b")).unwrap());
re!(NEXT_WEEK_RE, r"\bnext week\b");
re!(NEXT_WEEKEND_RE, r"\bnext weekend\b");
re!(THIS_WEEKEND_RE, r"\bthis weekend\b|\bweekend\b");
re!(END_OF_WEEK_RE, r"\bend of (?:the )?week\b");
re!(END_OF_MONTH_RE, r"\bend of (?:the )?month\b");
re!(END_OF_YEAR_RE, r"\bend of (?:the )?year\b");
re!(BEGINNING_OF_MONTH_RE, r"\bbeginning of (?:the )?(?:next )?month\b");
re!(NEXT_MONTH_RE, r"\bnext month\b");
re!(NEXT_YEAR_RE, r"\bnext year\b");
static NEXT_WEEKDAY_RE: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(&format!(r"\bnext {WD}(?:day)?\b")).unwrap());
static THIS_OR_BARE_WEEKDAY_RE: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(&format!(r"\b(?:this |on )?{WD}(?:day)?\b")).unwrap());
static MONTH_DAY_RE: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(&format!(r"\b{MON}\.? (\d{{1,2}})(?:st|nd|rd|th)?\b")).unwrap());
static DAY_MONTH_RE: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(&format!(r"\b(\d{{1,2}})(?:st|nd|rd|th)? of {MON}\b")).unwrap());
re!(NUMERIC_DATE_RE, r"\b(\d{1,2})/(\d{1,2})(?:/(\d{2,4}))?\b");
re!(BARE_ORDINAL_RE, r"\b(?:on |by )?the (\d{1,2})(?:st|nd|rd|th)\b");
re!(SOMEDAY_RE, r"\bsomeday\b|\bsometime\b|\bone day\b");

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
    // accepted for the "every N ..." forms.
    let mut repeat: Option<RepeatRule> = None;
    let mut repeat_weekday: Option<u32> = None;
    if eat(&mut buf, &REPEAT_WEEKDAY_KIND_RE).is_some() {
        repeat = Some(RepeatRule::Weekday);
    } else if eat(&mut buf, &REPEAT_OTHER_WEEK_RE).is_some() {
        repeat = Some(RepeatRule::Weekly { n: 2 });
    } else if let Some(g) = eat(&mut buf, &REPEAT_N_WEEKS_RE) {
        repeat = Some(RepeatRule::Weekly { n: num_from(&g, 1) });
    } else if eat(&mut buf, &REPEAT_WEEK_RE).is_some() {
        repeat = Some(RepeatRule::Weekly { n: 1 });
    } else if eat(&mut buf, &REPEAT_QUARTERLY_RE).is_some() {
        repeat = Some(RepeatRule::Monthly { n: 3, day_of_month: None });
    } else if let Some(g) = eat(&mut buf, &REPEAT_N_MONTHS_RE) {
        repeat = Some(RepeatRule::Monthly { n: num_from(&g, 1), day_of_month: None });
    } else if eat(&mut buf, &REPEAT_MONTH_RE).is_some() {
        repeat = Some(RepeatRule::Monthly { n: 1, day_of_month: None });
    } else if let Some(g) = eat(&mut buf, &REPEAT_N_DAYS_RE) {
        repeat = Some(RepeatRule::Daily { n: num_from(&g, 1) });
    } else if eat(&mut buf, &REPEAT_DAY_RE).is_some() {
        repeat = Some(RepeatRule::Daily { n: 1 });
    } else if eat(&mut buf, &REPEAT_YEAR_RE).is_some() {
        repeat = Some(RepeatRule::Yearly { n: 1 });
    } else if let Some(g) = eat(&mut buf, &REPEAT_WEEKDAY_NAME_RE) {
        if let Some(wd) = weekday_from(&g, 1) {
            repeat = Some(RepeatRule::WeeklyOn { weekday: wd });
            repeat_weekday = Some(wd);
        }
    } else if let Some(g) = eat(&mut buf, &REPEAT_ON_WEEKDAYS_RE) {
        if let Some(wd) = weekday_from(&g, 1) {
            repeat = Some(RepeatRule::WeeklyOn { weekday: wd });
            repeat_weekday = Some(wd);
        }
    }

    // 4. Date words, in priority order (first match wins).
    let mut delta: Option<i64> = None;
    let mut is_tonight = false;
    let mut ordinal_day_of_month: Option<u32> = None;
    let mut someday = false;

    if eat(&mut buf, &TONIGHT_RE).is_some() {
        delta = Some(0);
        is_tonight = true;
    } else if eat(&mut buf, &TODAY_RE).is_some() {
        delta = Some(0);
    } else if eat(&mut buf, &DAY_AFTER_TOMORROW_RE).is_some() {
        delta = Some(2);
    } else if eat(&mut buf, &TOMORROW_RE).is_some() {
        delta = Some(1);
    } else if let Some(g) = eat(&mut buf, &IN_N_DAYS_RE) {
        delta = Some(num_from(&g, 1) as i64);
    } else if let Some(g) = eat(&mut buf, &IN_N_WEEKS_RE) {
        delta = Some(num_from(&g, 1) as i64 * 7);
    } else if let Some(g) = eat(&mut buf, &IN_N_MONTHS_RE) {
        let target = today.add_months(num_from(&g, 1) as i64);
        delta = Some(days_between(today, target));
    } else if let Some(g) = eat(&mut buf, &N_DAYS_FROM_NOW_RE) {
        delta = Some(num_from(&g, 1) as i64);
    } else if eat(&mut buf, &NEXT_WEEK_RE).is_some() {
        delta = Some(7);
    } else if eat(&mut buf, &NEXT_WEEKEND_RE).is_some() {
        delta = Some(nearest_weekday_delta(today_wd, 6) + 7);
    } else if eat(&mut buf, &THIS_WEEKEND_RE).is_some() {
        delta = Some(if today_wd == 6 { 0 } else { nearest_weekday_delta(today_wd, 6) });
    } else if eat(&mut buf, &END_OF_WEEK_RE).is_some() {
        let raw = (5 - today_wd as i64).rem_euclid(7);
        delta = Some(if raw == 0 { 7 } else { raw });
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
    } else if eat(&mut buf, &NEXT_MONTH_RE).is_some() {
        delta = Some(days_between(today, today.add_months(1)));
    } else if eat(&mut buf, &NEXT_YEAR_RE).is_some() {
        delta = Some(days_between(today, SimpleDate::new(today.y + 1, today.m, today.d)));
    } else if let Some(g) = eat(&mut buf, &NEXT_WEEKDAY_RE) {
        if let Some(wd) = weekday_from(&g, 1) {
            delta = Some(next_weekday_delta(today_wd, wd));
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
    } else if eat(&mut buf, &SOMEDAY_RE).is_some() {
        someday = true;
    }

    if delta.is_none() {
        if let Some(wd) = repeat_weekday {
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
            } else {
                format!("{} {} {}", WEEKDAY_SHORT[target.weekday() as usize], MONTH_SHORT[(target.m - 1) as usize], target.d)
            };
            let group = if d == 0 { Group::Today } else if d <= 7 { Group::Upcoming } else { Group::Next };
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
        assert_eq!(p.repeat, Some(RepeatRule::WeeklyOn { weekday: 6 }));
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
    fn no_date_means_not_dated() {
        let p = parse_on(BASE, "Write the retro notes");
        assert!(!p.dated);
        assert_eq!(p.due_date, None);
        assert_eq!(p.title, "Write the retro notes");
    }
}
