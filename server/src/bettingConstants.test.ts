import { describe, it, expect } from "vitest";
import { getKillWinFactor, WIN_FACTORS, KILL_THRESHOLDS, BET_TYPES } from "./bettingConstants.js";

describe("getKillWinFactor", () => {
  it("returns 2 for totalKills < 15", () => {
    expect(getKillWinFactor(0)).toBe(2);
    expect(getKillWinFactor(10)).toBe(2);
    expect(getKillWinFactor(14)).toBe(2);
  });

  it("returns 1.1 for 15 <= totalKills < 30", () => {
    expect(getKillWinFactor(15)).toBe(1.1);
    expect(getKillWinFactor(20)).toBe(1.1);
    expect(getKillWinFactor(29)).toBe(1.1);
  });

  it("returns 1.3 for 30 <= totalKills < 50", () => {
    expect(getKillWinFactor(30)).toBe(1.3);
    expect(getKillWinFactor(40)).toBe(1.3);
    expect(getKillWinFactor(49)).toBe(1.3);
  });

  it("returns 1.5 for 50 <= totalKills < 60", () => {
    expect(getKillWinFactor(50)).toBe(1.5);
    expect(getKillWinFactor(55)).toBe(1.5);
    expect(getKillWinFactor(59)).toBe(1.5);
  });

  it("returns 2 for 60 <= totalKills < 70", () => {
    expect(getKillWinFactor(60)).toBe(2);
    expect(getKillWinFactor(65)).toBe(2);
    expect(getKillWinFactor(69)).toBe(2);
  });

  it("returns 3 for totalKills >= 70", () => {
    expect(getKillWinFactor(70)).toBe(3);
    expect(getKillWinFactor(80)).toBe(3);
    expect(getKillWinFactor(100)).toBe(3);
  });
});

describe("WIN_FACTORS", () => {
  it("has a factor for each BET_TYPE", () => {
    for (const t of BET_TYPES) {
      expect(WIN_FACTORS[t]).toBeDefined();
      expect(typeof WIN_FACTORS[t]).toBe("number");
      expect(WIN_FACTORS[t]).toBeGreaterThan(0);
    }
  });

  it("has expected values for main types", () => {
    expect(WIN_FACTORS.VICTORY).toBe(1.5);
    expect(WIN_FACTORS.EXACT_SCORE).toBe(1.75);
    expect(WIN_FACTORS.ACE).toBe(3);
    expect(WIN_FACTORS.QUAD_KILL).toBe(1.5);
    expect(WIN_FACTORS.MOST_KILLS).toBe(3);
    expect(WIN_FACTORS.KILLS).toBe(1.3);
  });
});

describe("KILL_THRESHOLDS", () => {
  it("contains the 6 expected thresholds", () => {
    expect(KILL_THRESHOLDS).toEqual(["<15", ">15", ">30", ">50", ">60", ">70"]);
  });
});
