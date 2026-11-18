import * as auth from '../services/auth.service.js';
import { getProfile, updateProfile } from '../services/profile.service.js';

export async function postRegister(req, res) {
  res.status(201).json(await auth.register(req.valid.body));
}

export async function postLogin(req, res) {
  res.json(await auth.login(req.valid.body));
}

export async function postRefresh(req, res) {
  res.json(await auth.refresh(req.valid.body));
}

export async function postLogout(req, res) {
  await auth.logout(req.accessToken);
  res.status(204).end();
}

export async function getMe(req, res) {
  res.json({ profile: await getProfile(req.db, req.user) });
}

export async function patchMe(req, res) {
  res.json({ profile: await updateProfile(req.db, req.user, req.valid.body) });
}

export async function deleteMe(req, res) {
  await auth.deleteAccount(req.user.id);
  res.status(204).end();
}
