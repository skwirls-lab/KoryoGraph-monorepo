/** Starter rank ladders for onboarding (F1.4). Schools rename, recolour and add requirements afterwards. */
export interface ProgramPreset { key: string; name: string; description: string; color: string; ranks: { name: string; color: string; stripes: number }[] }

export const PROGRAM_PRESETS: ProgramPreset[] = [
  { key: "taekwondo", name: "Taekwondo", description: "Colour belts to 1st Dan black belt.", color: "#e11d48", ranks: [
    { name: "White", color: "#f5f5f5", stripes: 2 }, { name: "Yellow", color: "#facc15", stripes: 2 }, { name: "Orange", color: "#f97316", stripes: 2 },
    { name: "Green", color: "#16a34a", stripes: 2 }, { name: "Purple", color: "#7c3aed", stripes: 2 }, { name: "Blue", color: "#2563eb", stripes: 2 },
    { name: "Brown", color: "#78350f", stripes: 2 }, { name: "Red", color: "#dc2626", stripes: 2 }, { name: "Red-Black", color: "#7f1d1d", stripes: 2 },
    { name: "1st Dan Black", color: "#111827", stripes: 0 },
  ] },
  { key: "karate", name: "Karate", description: "Kyu grades to Shodan.", color: "#2563eb", ranks: [
    { name: "White (10th kyu)", color: "#f5f5f5", stripes: 0 }, { name: "Yellow (9th kyu)", color: "#facc15", stripes: 0 }, { name: "Orange (8th kyu)", color: "#f97316", stripes: 0 },
    { name: "Green (7th kyu)", color: "#16a34a", stripes: 0 }, { name: "Blue (6th kyu)", color: "#2563eb", stripes: 0 }, { name: "Purple (5th kyu)", color: "#7c3aed", stripes: 0 },
    { name: "Brown (3rd kyu)", color: "#78350f", stripes: 0 }, { name: "Brown (2nd kyu)", color: "#78350f", stripes: 0 }, { name: "Brown (1st kyu)", color: "#78350f", stripes: 0 },
    { name: "Shodan", color: "#111827", stripes: 0 },
  ] },
  { key: "bjj", name: "Brazilian Jiu-Jitsu (adult)", description: "Adult belts with four stripes each.", color: "#1d4ed8", ranks: [
    { name: "White", color: "#f5f5f5", stripes: 4 }, { name: "Blue", color: "#1d4ed8", stripes: 4 }, { name: "Purple", color: "#6d28d9", stripes: 4 },
    { name: "Brown", color: "#78350f", stripes: 4 }, { name: "Black", color: "#111827", stripes: 6 },
  ] },
  { key: "kickboxing", name: "Kickboxing", description: "Six grades from beginner to instructor level.", color: "#ea580c", ranks: [
    { name: "Level 1 (White)", color: "#f5f5f5", stripes: 0 }, { name: "Level 2 (Yellow)", color: "#facc15", stripes: 0 }, { name: "Level 3 (Orange)", color: "#f97316", stripes: 0 },
    { name: "Level 4 (Green)", color: "#16a34a", stripes: 0 }, { name: "Level 5 (Blue)", color: "#2563eb", stripes: 0 }, { name: "Level 6 (Black)", color: "#111827", stripes: 0 },
  ] },
];
