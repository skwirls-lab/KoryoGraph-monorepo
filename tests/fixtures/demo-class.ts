// The demo's recorded class (§6 step 13): the most recent Youth Taekwondo — Advanced session, whose roster
// (rank 7+ youth) includes these ten seeded students. Shared by the fixture author script, the demo seed and
// the seed invariants.
import { sid } from "../../scripts/lib/ids";

const p = (n: number) => sid(`person:ridgeline:demo-${n}`);
export const DEMO_CLASS = {
  className: "Youth Taekwondo — Advanced",
  present: { berry: p(65), beulah: p(234), edmond: p(63), greta: p(124), houston: p(74), jody: p(219), louisa: p(123), sabina: p(249), thelma: p(262) },
  unsure: { joesph: p(175) },
  skills: {
    doubleRoundhouse: sid("skill:ridgeline:kick:Double roundhouse"),
    taegeukOh: sid("skill:ridgeline:form:Taegeuk Oh Jang"),
    oneStep5: sid("skill:ridgeline:one_step:One-step sparring #5"),
  },
};

export const DEMO_CLASS_TRANSCRIPT = `Okay, good work tonight, everybody. Tonight we had Berry, Beulah, Edmond, Greta, Houston, Jody, Louisa, Sabina and Thelma. I think Joesph came in late at the back but I didn't see him check in.
Berry's double roundhouse is there now — both kicks at head height and he landed balanced. Sign that one off.
Sabina did Taegeuk Oh Jang start to finish with sharp stances; that's a pass.
Edmond, one-step number five, clean and controlled. Sign it off.
Greta jammed her wrist on the speed break, it looked a bit swollen, so let's keep her off breaking next class.
And someone please call Louisa's parents — she asked about trying out for the Demo Team.`;
