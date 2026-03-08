import * as WeeklyOffService from "./weeklyoff_services.js";

// CREATE
export async function createWeeklyOffRule(req, res) {
  try {
    const rule = await WeeklyOffService.createWeeklyOffRule(
      req.body,
      req.user.id
    );

    res.status(201).json(rule);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
}

// GET
export async function getWeeklyOffRules(req, res) {
  try {
    const rules = await WeeklyOffService.getWeeklyOffRules();
    res.json(rules);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
}

// UPDATE
export async function updateWeeklyOffRule(req, res) {
  try {
    const rule = await WeeklyOffService.updateWeeklyOffRule(
      req.params.id,
      req.body,
      req.user.id
    );

    res.json(rule);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
}

// DELETE
export async function deleteWeeklyOffRule(req, res) {
  try {
    await WeeklyOffService.deleteWeeklyOffRule(
      req.params.id,
      req.user.id
    );

    res.json({ message: "Weekly off rule deactivated successfully" });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
}