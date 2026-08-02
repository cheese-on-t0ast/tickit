use serde::Serialize;

#[derive(Serialize, Clone, Copy, Debug, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum Priority {
    High,
    Med,
    Low,
}

#[derive(Serialize, Clone, Copy, Debug, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum Group {
    Today,
    Upcoming,
    Next,
    Later,
}

#[derive(Serialize, Clone, Debug, PartialEq)]
#[serde(tag = "freq")]
pub enum RepeatRule {
    #[serde(rename = "daily")]
    Daily { n: u32 },
    #[serde(rename = "weekday")]
    Weekday,
    #[serde(rename = "weekly")]
    Weekly { n: u32 },
    #[serde(rename = "monthly")]
    Monthly {
        n: u32,
        #[serde(rename = "dayOfMonth", skip_serializing_if = "Option::is_none")]
        day_of_month: Option<u32>,
    },
    #[serde(rename = "yearly")]
    Yearly { n: u32 },
    /// A specific weekday, optionally every `n` weeks (n = 1 weekly, 2 for
    /// "every other Thursday", etc).
    #[serde(rename = "weeklyOn")]
    WeeklyOn { weekday: u32, n: u32 },
    /// The `week`-th `weekday` of every `n` months — e.g. "the first Thursday
    /// of each month". `week` is 1..=5, or -1 for "last".
    #[serde(rename = "monthlyDow")]
    MonthlyDow { n: u32, week: i32, weekday: u32 },
}

#[derive(Serialize, Clone, Debug, PartialEq)]
pub struct ParsedCapture {
    pub title: String,
    #[serde(rename = "listId")]
    pub list_id: String,
    #[serde(rename = "listGiven")]
    pub list_given: bool,
    pub priority: Priority,
    pub tags: Vec<String>,
    #[serde(rename = "dueDate")]
    pub due_date: Option<String>,
    #[serde(rename = "dueTime")]
    pub due_time: Option<String>,
    pub label: String,
    pub repeat: Option<RepeatRule>,
    pub group: Group,
    pub dated: bool,
}
