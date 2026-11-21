import { DatabaseSync } from "node:sqlite";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const now = () => new Date().toISOString();
const hashToken = token => createHash("sha256").update(token).digest("hex");

export function createDatabase(filename) {
  if (filename !== ":memory:") fs.mkdirSync(path.dirname(filename), { recursive: true });
  const db = new DatabaseSync(filename);
  db.exec("PRAGMA foreign_keys = ON");
  if (filename !== ":memory:") db.exec("PRAGMA journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      token_hash TEXT UNIQUE NOT NULL,
      display_name TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS homes (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      owner_user_id TEXT NOT NULL REFERENCES users(id),
      snapshot_json TEXT NOT NULL DEFAULT '{}',
      version INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS memberships (
      home_id TEXT NOT NULL REFERENCES homes(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role TEXT NOT NULL CHECK(role IN ('owner','member')),
      joined_at TEXT NOT NULL,
      PRIMARY KEY(home_id, user_id)
    );
    CREATE TABLE IF NOT EXISTS invites (
      code TEXT PRIMARY KEY,
      home_id TEXT NOT NULL REFERENCES homes(id) ON DELETE CASCADE,
      created_by TEXT NOT NULL REFERENCES users(id),
      expires_at TEXT NOT NULL,
      max_uses INTEGER NOT NULL DEFAULT 5,
      uses INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS partner_offers (
      id TEXT PRIMARY KEY,
      partner_name TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      price_label TEXT NOT NULL DEFAULT '',
      category TEXT NOT NULL,
      brand TEXT NOT NULL DEFAULT '',
      target_url TEXT NOT NULL,
      sub_id_param TEXT NOT NULL DEFAULT 'subid',
      priority INTEGER NOT NULL DEFAULT 0,
      active INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS partner_clicks (
      id TEXT PRIMARY KEY,
      offer_id TEXT NOT NULL REFERENCES partner_offers(id),
      placement TEXT NOT NULL DEFAULT 'purchase_options',
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS partner_impressions (
      id TEXT PRIMARY KEY,
      offer_id TEXT NOT NULL REFERENCES partner_offers(id),
      placement TEXT NOT NULL DEFAULT 'dashboard_banner',
      created_at TEXT NOT NULL
    );
  `);

  const queries = {
    insertUser: db.prepare("INSERT INTO users(id, token_hash, display_name, created_at) VALUES(?,?,?,?)"),
    userByHash: db.prepare("SELECT id, display_name FROM users WHERE token_hash = ?"),
    insertHome: db.prepare("INSERT INTO homes(id, name, owner_user_id, snapshot_json, version, created_at, updated_at) VALUES(?,?,?,?,1,?,?)"),
    insertMember: db.prepare("INSERT OR IGNORE INTO memberships(home_id, user_id, role, joined_at) VALUES(?,?,?,?)"),
    membership: db.prepare("SELECT role FROM memberships WHERE home_id = ? AND user_id = ?"),
    members: db.prepare("SELECT users.id, users.display_name, memberships.role, memberships.joined_at FROM memberships JOIN users ON users.id = memberships.user_id WHERE memberships.home_id = ? ORDER BY CASE memberships.role WHEN 'owner' THEN 0 ELSE 1 END, memberships.joined_at"),
    home: db.prepare("SELECT id, name, snapshot_json, version, updated_at FROM homes WHERE id = ?"),
    updateHome: db.prepare("UPDATE homes SET snapshot_json = ?, version = version + 1, updated_at = ? WHERE id = ? AND version = ?"),
    insertInvite: db.prepare("INSERT INTO invites(code, home_id, created_by, expires_at, max_uses, uses, created_at) VALUES(?,?,?,?,?,0,?)"),
    invite: db.prepare("SELECT code, home_id, expires_at, max_uses, uses FROM invites WHERE code = ?"),
    useInvite: db.prepare("UPDATE invites SET uses = uses + 1 WHERE code = ? AND uses < max_uses"),
    upsertOffer: db.prepare(`INSERT INTO partner_offers(id, partner_name, title, description, price_label, category, brand, target_url, sub_id_param, priority, active, updated_at)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?)
      ON CONFLICT(id) DO UPDATE SET partner_name=excluded.partner_name, title=excluded.title, description=excluded.description,
      price_label=excluded.price_label, category=excluded.category, brand=excluded.brand, target_url=excluded.target_url,
      sub_id_param=excluded.sub_id_param, priority=excluded.priority, active=excluded.active, updated_at=excluded.updated_at`),
    offersByCategory: db.prepare(`SELECT id, partner_name, title, description, price_label, category, brand
      FROM partner_offers WHERE active = 1 AND (category = ? OR category = 'all') AND (brand = '' OR lower(brand) = lower(?))
      ORDER BY priority DESC, updated_at DESC LIMIT 8`),
    offerTarget: db.prepare("SELECT id, target_url, sub_id_param FROM partner_offers WHERE id = ? AND active = 1"),
    insertPartnerClick: db.prepare("INSERT INTO partner_clicks(id, offer_id, placement, created_at) VALUES(?,?,?,?)"),
    insertPartnerImpression: db.prepare("INSERT INTO partner_impressions(id, offer_id, placement, created_at) VALUES(?,?,?,?)")
  };

  function validHttpUrl(value) {
    try {
      const parsed = new URL(value);
      return parsed.protocol === "https:";
    } catch {
      return false;
    }
  }

  function syncOffers(offers = []) {
    if (!Array.isArray(offers)) return;
    const timestamp = now();
    for (const offer of offers) {
      const id = String(offer?.id || "").trim().slice(0, 80);
      const targetUrl = String(offer?.targetUrl || "").trim();
      if (!id || !validHttpUrl(targetUrl)) continue;
      queries.upsertOffer.run(
        id,
        String(offer.partnerName || "Партнёр").trim().slice(0, 80),
        String(offer.title || "Предложение партнёра").trim().slice(0, 120),
        String(offer.description || "").trim().slice(0, 240),
        String(offer.priceLabel || "").trim().slice(0, 60),
        String(offer.category || "all").trim().slice(0, 60),
        String(offer.brand || "").trim().slice(0, 80),
        targetUrl,
        String(offer.subIdParam || "subid").trim().replace(/[^a-zA-Z0-9_.-]/g, "").slice(0, 60) || "subid",
        Number.isFinite(Number(offer.priority)) ? Number(offer.priority) : 0,
        offer.active === false ? 0 : 1,
        timestamp
      );
    }
  }

  function listOffers(category, brand = "") {
    return queries.offersByCategory.all(String(category || "all").slice(0, 60), String(brand || "").slice(0, 80)).map(row => ({
      id: row.id,
      partnerName: row.partner_name,
      title: row.title,
      description: row.description,
      priceLabel: row.price_label,
      category: row.category,
      brand: row.brand
    }));
  }

  function createPartnerClick(offerId, placement = "purchase_options") {
    const offer = queries.offerTarget.get(String(offerId || ""));
    if (!offer) return null;
    const clickId = randomUUID();
    queries.insertPartnerClick.run(clickId, offer.id, String(placement || "purchase_options").slice(0, 60), now());
    const target = new URL(offer.target_url);
    target.searchParams.set(offer.sub_id_param || "subid", clickId);
    return { clickId, targetUrl: target.toString() };
  }

  function recordPartnerImpression(offerId, placement = "dashboard_banner") {
    const offer = queries.offerTarget.get(String(offerId || ""));
    if (!offer) return null;
    const impressionId = randomUUID();
    queries.insertPartnerImpression.run(impressionId, offer.id, String(placement || "dashboard_banner").slice(0, 60), now());
    return { impressionId };
  }

  function createSession(displayName = "Участник") {
    const token = randomBytes(32).toString("base64url");
    const user = { id: randomUUID(), displayName: String(displayName).trim().slice(0, 40) || "Участник" };
    queries.insertUser.run(user.id, hashToken(token), user.displayName, now());
    return { ...user, token };
  }

  function authenticate(token) {
    if (!token || token.length < 20) return null;
    return queries.userByHash.get(hashToken(token)) || null;
  }

  function requireMembership(homeId, userId) {
    return queries.membership.get(homeId, userId) || null;
  }

  function createHome(userId, name, snapshot = {}) {
    const id = randomUUID();
    const timestamp = now();
    queries.insertHome.run(id, String(name).trim().slice(0, 60) || "Мой дом", userId, JSON.stringify(snapshot), timestamp, timestamp);
    queries.insertMember.run(id, userId, "owner", timestamp);
    return getHome(id, userId);
  }

  function getHome(homeId, userId) {
    const membership = requireMembership(homeId, userId);
    if (!membership) return null;
    const row = queries.home.get(homeId);
    return row ? {
      id: row.id,
      name: row.name,
      snapshot: JSON.parse(row.snapshot_json),
      version: row.version,
      updatedAt: row.updated_at,
      currentRole: membership.role,
      members: queries.members.all(homeId).map(member => ({ id: member.id, displayName: member.display_name, role: member.role, joinedAt: member.joined_at }))
    } : null;
  }

  function updateHome(homeId, userId, snapshot, expectedVersion) {
    if (!requireMembership(homeId, userId)) return { status: "forbidden" };
    const current = queries.home.get(homeId);
    if (!current) return { status: "missing" };
    if (Number(expectedVersion) !== current.version) return { status: "conflict", home: getHome(homeId, userId) };
    const result = queries.updateHome.run(JSON.stringify(snapshot), now(), homeId, current.version);
    if (!result.changes) return { status: "conflict", home: getHome(homeId, userId) };
    return { status: "ok", home: getHome(homeId, userId) };
  }

  function createInvite(homeId, userId) {
    const membership = requireMembership(homeId, userId);
    if (!membership || membership.role !== "owner") return null;
    const code = randomBytes(6).toString("base64url").toUpperCase();
    const expiresAt = new Date(Date.now() + 7 * 86_400_000).toISOString();
    queries.insertInvite.run(code, homeId, userId, expiresAt, 5, now());
    return { code, homeId, expiresAt, maxUses: 5 };
  }

  function joinInvite(code, userId) {
    const invite = queries.invite.get(String(code).trim().toUpperCase());
    if (!invite || Date.parse(invite.expires_at) < Date.now() || invite.uses >= invite.max_uses) return null;
    queries.insertMember.run(invite.home_id, userId, "member", now());
    queries.useInvite.run(invite.code);
    return getHome(invite.home_id, userId);
  }

  return { db, createSession, authenticate, createHome, getHome, updateHome, createInvite, joinInvite, syncOffers, listOffers, createPartnerClick, recordPartnerImpression };
}
