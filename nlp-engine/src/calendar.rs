//! Pure Gregorian calendar arithmetic — no OS clock access, so it's safe to
//! compile for wasm32-unknown-unknown. "Today" is always supplied by the
//! caller (JS `Date` on the host side).
//!
//! Day-counting uses Howard Hinnant's `days_from_civil`/`civil_from_days`
//! algorithm (public domain), which is correct for the whole proleptic
//! Gregorian calendar and trivially gives us weekday, date-add and
//! date-subtract without a fragile month-by-month loop.

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct SimpleDate {
    pub y: i32,
    pub m: u32,
    pub d: u32,
}

pub fn days_from_civil(y: i64, m: u32, d: u32) -> i64 {
    let y = if m <= 2 { y - 1 } else { y };
    let era = if y >= 0 { y } else { y - 399 } / 400;
    let yoe = y - era * 400; // [0, 399]
    let mp = (m as i64 + 9) % 12; // [0, 11]
    let doy = (153 * mp + 2) / 5 + d as i64 - 1; // [0, 365]
    let doe = yoe * 365 + yoe / 4 - yoe / 100 + doy; // [0, 146096]
    era * 146097 + doe - 719468
}

pub fn civil_from_days(z: i64) -> (i32, u32, u32) {
    let z = z + 719468;
    let era = if z >= 0 { z } else { z - 146096 } / 146097;
    let doe = z - era * 146097; // [0, 146096]
    let yoe = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365; // [0, 399]
    let y = yoe + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100); // [0, 365]
    let mp = (5 * doy + 2) / 153; // [0, 11]
    let d = (doy - (153 * mp + 2) / 5 + 1) as u32; // [1, 31]
    let m = if mp < 10 { mp + 3 } else { mp - 9 } as u32; // [1, 12]
    let y = if m <= 2 { y + 1 } else { y };
    (y as i32, m, d)
}

pub fn is_leap_year(y: i32) -> bool {
    (y % 4 == 0 && y % 100 != 0) || y % 400 == 0
}

pub fn days_in_month(y: i32, m: u32) -> u32 {
    match m {
        1 | 3 | 5 | 7 | 8 | 10 | 12 => 31,
        4 | 6 | 9 | 11 => 30,
        2 => if is_leap_year(y) { 29 } else { 28 },
        _ => 30,
    }
}

impl SimpleDate {
    pub fn new(y: i32, m: u32, d: u32) -> Self {
        Self { y, m, d }
    }

    pub fn ordinal(&self) -> i64 {
        days_from_civil(self.y as i64, self.m, self.d)
    }

    pub fn add_days(&self, delta: i64) -> Self {
        let (y, m, d) = civil_from_days(self.ordinal() + delta);
        Self { y, m, d }
    }

    /// Same day-of-month next `n` months, clamped to the target month's length.
    pub fn add_months(&self, n: i64) -> Self {
        let total = (self.m as i64 - 1) + n;
        let y = self.y as i64 + total.div_euclid(12);
        let m = (total.rem_euclid(12) + 1) as u32;
        let d = self.d.min(days_in_month(y as i32, m));
        Self { y: y as i32, m, d }
    }

    /// 0 = Sunday .. 6 = Saturday
    pub fn weekday(&self) -> u32 {
        (self.ordinal() + 4).rem_euclid(7) as u32
    }

    pub fn days_in_month(&self) -> u32 {
        days_in_month(self.y, self.m)
    }

    pub fn to_iso(&self) -> String {
        format!("{:04}-{:02}-{:02}", self.y, self.m, self.d)
    }
}

pub fn days_between(a: SimpleDate, b: SimpleDate) -> i64 {
    b.ordinal() - a.ordinal()
}

pub const WEEKDAY_SHORT: [&str; 7] = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
pub const MONTH_SHORT: [&str; 12] =
    ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/// Maps a 3-letter weekday abbreviation (as produced by our regexes, which
/// always capture irregular short forms like "tue"/"wed"/"thu") to 0..6.
pub fn weekday_from_abbrev3(abbrev3: &str) -> Option<u32> {
    match abbrev3 {
        "sun" => Some(0),
        "mon" => Some(1),
        "tue" => Some(2),
        "wed" => Some(3),
        "thu" => Some(4),
        "fri" => Some(5),
        "sat" => Some(6),
        _ => None,
    }
}

/// Maps a month name/abbreviation to 1..12.
pub fn month_from_name(name: &str) -> Option<u32> {
    let n = name.to_lowercase();
    let prefix3 = &n[..n.len().min(3)];
    match prefix3 {
        "jan" => Some(1),
        "feb" => Some(2),
        "mar" => Some(3),
        "apr" => Some(4),
        "may" => Some(5),
        "jun" => Some(6),
        "jul" => Some(7),
        "aug" => Some(8),
        "sep" => Some(9),
        "oct" => Some(10),
        "nov" => Some(11),
        "dec" => Some(12),
        _ => None,
    }
}

pub fn word_to_num(s: &str) -> Option<u32> {
    match s {
        "one" => Some(1),
        "two" => Some(2),
        "three" => Some(3),
        "four" => Some(4),
        "five" => Some(5),
        "six" => Some(6),
        "seven" => Some(7),
        "eight" => Some(8),
        "nine" => Some(9),
        "ten" => Some(10),
        "eleven" => Some(11),
        "twelve" => Some(12),
        _ => s.parse().ok(),
    }
}

/// Delta (in days) to the *nearest upcoming* occurrence of `target` weekday,
/// treating "today is that weekday" as 7 days out (i.e. next week), matching
/// how people read a bare weekday name.
pub fn nearest_weekday_delta(today_wd: u32, target_wd: u32) -> i64 {
    let raw = (target_wd as i64 - today_wd as i64).rem_euclid(7);
    if raw == 0 { 7 } else { raw }
}

/// Delta to the occurrence of `target` weekday *after* the nearest one —
/// this is what "next <weekday>" means as distinct from a bare weekday name.
pub fn next_weekday_delta(today_wd: u32, target_wd: u32) -> i64 {
    let nearest = nearest_weekday_delta(today_wd, target_wd);
    if nearest == 7 { 7 } else { nearest + 7 }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn round_trips_civil_days() {
        for (y, m, d) in [(2026, 8, 1), (2000, 2, 29), (1970, 1, 1), (1969, 12, 31), (2100, 3, 1)] {
            let n = days_from_civil(y, m, d);
            assert_eq!(civil_from_days(n), (y as i32, m, d));
        }
    }

    #[test]
    fn known_weekday() {
        // 1970-01-01 was a Thursday.
        assert_eq!(SimpleDate::new(1970, 1, 1).weekday(), 4);
        // 2026-08-01 is a Saturday.
        assert_eq!(SimpleDate::new(2026, 8, 1).weekday(), 6);
    }

    #[test]
    fn add_months_rolls_year_and_clamps() {
        assert_eq!(SimpleDate::new(2026, 12, 31).add_months(1), SimpleDate::new(2027, 1, 31));
        assert_eq!(SimpleDate::new(2026, 1, 31).add_months(1), SimpleDate::new(2026, 2, 28));
    }

    #[test]
    fn add_days_rolls_year() {
        assert_eq!(SimpleDate::new(2026, 12, 31).add_days(2), SimpleDate::new(2027, 1, 2));
    }
}
