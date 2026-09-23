// Shared by the action-board spec and the fixture author script: a self-contained class with fixed ids.
import { sid } from "../../scripts/lib/ids";

export const AB = {
  program: sid("program:ridgeline:ab-test"),
  rank1: sid("rank:ridgeline:ab-test:1"),
  rank2: sid("rank:ridgeline:ab-test:2"),
  skills: { lowBlock: sid("skill:ridgeline:ab-test:low-block"), frontKick: sid("skill:ridgeline:ab-test:front-kick"), taegeuk1: sid("skill:ridgeline:ab-test:taegeuk-1") },
  session: sid("session:ridgeline:ab-test"),
  students: ["Ari", "Bea", "Cal", "Dee", "Eli", "Fay", "Gus", "Hal", "Ivy", "Jo"].map((first) => ({ first, last: "Boardtest", id: sid(`person:ridgeline:ab-${first.toLowerCase()}`), enrollment: sid(`enrollment:ridgeline:ab-${first.toLowerCase()}`) })),
};

export const AB_TRANSCRIPT = `Great class tonight, everyone worked hard. Here tonight: Ari, Bea, Cal, Dee, Eli, Fay, Gus, Hal and Ivy. I think Jo was in the back row but I'm not sure.
Ari nailed the low block — sign it off. Bea's front kick is ready, sign that off too. Cal performed Taegeuk 1 cleanly, that's a pass.
Dee rolled her ankle a bit during sparring; keep an eye on it next class.
Can someone call Eli's parents about moving up to the advanced class?`;
