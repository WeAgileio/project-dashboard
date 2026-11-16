# Spec Delta

## MODIFIED Requirements

### Requirement: Weekly trends hidden for Notion

When the active source is Notion, the application SHALL hide the「十週更新統計」tab and SHALL NOT load weekly task-update data. The logged-in Notion dashboard SHALL show「Sprint 趨勢」with「專案進展」「請款進展」and「請款進展·時間序」.

#### Scenario: Weekly tab hidden

- **WHEN** the active source is Notion and the user is logged in
- **THEN** the visible tabs are「專案進展」「請款進展」「請款進展·時間序」and「Sprint 趨勢」, and「十週更新統計」is not visible
