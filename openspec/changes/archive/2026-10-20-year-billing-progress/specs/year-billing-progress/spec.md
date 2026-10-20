## Purpose

在「專案進展」、「請款進展」與「請款進展·時間序」用已收金額、該年應收與百分比，展示每個年度的請款進度。

## ADDED Requirements

### Requirement: Billing task year comes from the due date

A billing task SHALL belong to the calendar year written on its due date. A billing task with no due date SHALL NOT belong to any year.

#### Scenario: Undated billing task is excluded

- **WHEN** a billing task has a billing amount and no due date
- **THEN** that amount is not included in any year's collected amount or total

### Requirement: Year progress uses billing amounts

Collected amount for a year SHALL be the sum of billing amounts on completed billing tasks in that year. The year total SHALL be the sum of billing amounts on all billing tasks in that year. A missing billing amount SHALL count as zero. Progress percent SHALL be the collected amount divided by the year total, rounded to the nearest whole number. Progress SHALL NOT be computed from task counts.

#### Scenario: Completed amount counts as collected

- **WHEN** a billing task due in 2026 is completed and its billing amount is 100
- **THEN** that 100 is included in both the 2026 collected amount and the 2026 total

#### Scenario: Open amount counts only toward the total

- **WHEN** a billing task due in 2026 is not completed and its billing amount is 50
- **THEN** that 50 is included in the 2026 total and not in the 2026 collected amount

### Requirement: Timeline year headers show aggregate progress

On 專案進展 and 請款進展·時間序, each year header SHALL show that year's collected amount, year total, and progress percent after the year, for billing tasks of the projects currently shown. The figures SHALL follow the billing task's own due year, not the month column of a parent section. The current local calendar year SHALL be visually distinct from other years. When the year total is zero, the year header SHALL omit the amounts and the percent.

#### Scenario: Filtered projects form the year total

- **WHEN** the user is viewing 請款進展·時間序 and a hidden project has a 2026 billing task
- **THEN** that task's amount is not included in the 2026 header progress

#### Scenario: Section column does not move the year

- **WHEN** the user is viewing 專案進展 and a billing task due in 2026 belongs to a section shown under 2025
- **THEN** the task's amount is included in the 2026 header progress and not in the 2025 header progress

#### Scenario: Zero year total omits figures

- **WHEN** a visible year has no billing amount
- **THEN** that year header shows the year and does not show a slash or a percent

### Requirement: Project year lines include the percent

On 請款進展, each project's existing year line SHALL show that project's collected amount, year total, and progress percent for that year. The current local calendar year SHALL stay visually distinct. A year with a zero total SHALL NOT appear as a year line. The page SHALL NOT add a separate all-projects year total.

#### Scenario: Project year line shows its own progress

- **WHEN** a shown project has a 2026 collected amount of 1 and a 2026 total of 4
- **THEN** that project's 2026 line shows 1, 4, and 25%

#### Scenario: Another project's amount stays separate

- **WHEN** a second shown project also has a 2026 billing amount
- **THEN** the first project's 2026 line does not include the second project's amount

### Requirement: Month billing headers stay as they are

請款進展·時間序 month headers SHALL keep their existing task counts and collected-over-total billing amounts. Year progress text SHALL NOT change how month column width is chosen.

#### Scenario: Month header billing row remains

- **WHEN** the user views 請款進展·時間序
- **THEN** each month header still shows its collected amount and total, and the year progress is only on the year header
