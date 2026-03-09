import * as HrService from "./hr_services.js";

export async function getPendingUsers(req, res) {
  const users = await HrService.fetchPendingUsers();
  res.json(users);
}


export async function approveUser(req, res) {
  console.log(req.body, req.user.id, "req.user.id")
  await HrService.approveUser(req.body, req.user.id);
  res.json({ message: "User approved successfully" });
}


export async function rejectUser(req, res) {
  await HrService.rejectUser(req.body, req.user.id);
  res.json({ message: "User rejected" });
}



// Controllers know about HTTP.
// Services know about business logic.
// services should NOT know about HTTP or Express

// ✔ Services are framework-agnostic
// ✔ Easy to test services
// ✔ Clear data flow
// ✔ No hidden dependencies
// ✔ No tight coupling to Express
// This is exactly how real production code is written.