import * as AuthService from "./auth_services.js";

export async function register(req, res) {
  const user = await AuthService.registerUser(req.body);
  res.status(201).json({
    message: "Registration successful. Await HR approval."
  });
}

export async function login(req, res) {
  const tokens = await AuthService.loginUser(req.body, res);
  res.json(tokens);
}

export async function refresh(req, res) {
  const token = await AuthService.refreshToken(req, res);
  res.json(token);
}


export async function logout(req, res) {
  await AuthService.logoutUser(req, res);
  res.json({ message: "Logged out successfully" });
}


export async function activateAccount(req, res) {
  await AuthService.completeFirstLogin(
    req.body.id,
    req.body.newPassword
  );
  res.json({ message: "Password updated successfully" });
}


export async function changePass(req,res) {
  await AuthService.changePassword(
     req.user.id,
    req.body.oldPassword,
    req.body.newPassword
  );
  res.json({ message: "Password updated successfully" });
}