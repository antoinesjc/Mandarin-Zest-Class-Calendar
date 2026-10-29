// ═══ LEVELS and CATEGORIES of Club sessions, shared by the calendar, trial.html and next-sessions.html ═══
// Change a label or a colour here and every widget follows. The keys must match scripts/build_events.py.
// In Google Calendar, each event's description sets them with lines like:
//     Level: Beginner
//     Category: Conversation, Culture
//     Host: Dorota
var MZ_LEVELS = ["Beginner", "Intermediate", "Advanced", "All levels"];
var MZ_CATEGORIES = {
  conversation: { label: "Conversation", color: "#b4512a" },
  culture:      { label: "Culture",      color: "#a63d6b" },
  grammar:      { label: "Grammar",      color: "#3f63a3" },
  characters:   { label: "Characters",   color: "#7d5a8c" },
  bookclub:     { label: "Book club",    color: "#8a5a2b" },
  listening:    { label: "Listening",    color: "#2a7480" },
  reading:      { label: "Reading",      color: "#3f6d5e" },
  vocabulary:   { label: "Vocabulary",   color: "#8f6418" },
  noagenda:     { label: "No agenda",    color: "#6b6559" }
};
