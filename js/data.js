/* Demo data. Everything here is simulated; no real accounts or live pipeline. */
var DATA = {
  // Placeholder handprint factor (kg CO2e avoided per kg grounds diverted). Replace with a validated figure.
  handprintFactor: 0.34,

  // Points come only from a verified final photo. Level = highest threshold reached.
  levels:[{n:1,name:"Sprout",at:0},{n:2,name:"Seedling",at:30},{n:3,name:"Sapling",at:100},{n:4,name:"Tree",at:160}],

  // The 4-week journey shown on the Path page. A week is done when all its projects have their photo step finished.
  weeks:[
    {n:1,name:"Start",goal:"Use the dried grounds from your kit to make your first product.",projects:["p4"]},
    {n:2,name:"Create",goal:"Make something colourful with your grounds.",projects:["p5"]},
    {n:3,name:"Grow",goal:"Feed a seedling with your grounds. Needs level 2.",projects:["p2"]},
    {n:4,name:"Finish",goal:"Make your final product. Needs level 3.",projects:["p6"]}
  ],

  // Every project ends with a photo step (index 4) that the AI checks against photoPrompt.
  projects: [
    { id:"p4", name:"Deodoriser sachets", level:1, pts:30, plant:"flower", color:"#BB758A",
      desc:"Little fabric pouches of the dried grounds from your kit that soak up smells in shoes, bags and cupboards.",
      photoPrompt:"one or more small fabric or cloth pouches (sachets) that are tied closed and filled with dried coffee grounds",
      steps:[
      ["Get grounds","Scoop two tablespoons of the dried grounds from your kit container."],
      ["Fill","Spoon two tablespoons of grounds into the middle of a small square of cloth or a clean old sock."],
      ["Scent","Optional: add a few pieces of dried orange peel or a cinnamon stick."],
      ["Tie","Gather the cloth and tie it tightly with string so nothing spills."],
      ["Photo","Take a photo of your finished sachet and upload it."]]},
    { id:"p5", name:"Coffee watercolour", level:1, pts:30, plant:"bloom", color:"#F4CE5B",
      desc:"Brew brown paint from grounds and make a painting with it.",
      photoPrompt:"a painting or drawing on paper made with brown coffee-coloured watercolour paint, ideally with a brush, jar or cup of coffee paint nearby",
      steps:[
      ["Brew","With an adult's help, steep 2 tablespoons of grounds in half a cup of hot water for 10 minutes."],
      ["Strain","Let it cool, then pour through a sieve or coffee filter into a jar."],
      ["Test","Dab a bit on scrap paper. Add more grounds for a darker brown."],
      ["Paint","Paint a picture. Try layers: let each dry before the next."],
      ["Photo","Take a photo of your finished painting and upload it."]]},
    { id:"p2", name:"Grow a seedling", level:2, pts:40, plant:"flower", color:"#BB758A",
      desc:"Mix grounds into soil and grow a seedling.",
      photoPrompt:"a small pot or cup of soil with a young seedling or freshly sown seeds, dark soil mixed with coffee grounds",
      steps:[
      ["Mix","Mix one part grounds from your kit with four parts soil."],
      ["Pot","Fill a pot or cup and press the mix down gently."],
      ["Sow","Plant two seeds about a finger-joint deep."],
      ["Water","Water lightly. The soil should be damp, not soggy."],
      ["Photo","Take a photo of your potted seedling and upload it."]]},
    { id:"p6", name:"Coffee ground scrub", level:3, pts:60, plant:"flower", color:"#721F1F",
      desc:"A gentle body scrub. Unlocks at level 3 and needs an adult. Skin products need extra care.",
      photoPrompt:"a small jar or container of homemade coffee ground scrub (grounds mixed with sugar or oil), ideally with a handwritten label",
      steps:[
      ["Adult OK","Ask an adult first and check for allergies. Wash your hands."],
      ["Mix","Mix 2 tablespoons grounds from your kit, 2 tablespoons sugar and 1 tablespoon coconut oil."],
      ["Jar","Spoon the scrub into a clean jar and close the lid."],
      ["Label","Write the date and your batch ID on a label. Use within two weeks."],
      ["Photo","Take a photo of your labelled jar and upload it."]]}
  ],

  // Daily quiz: one question per local calendar day, cycling through these 10. Later this can be swapped for AI-generated questions.
  quiz: [
    {q:"Why does CoffeeBot dry the grounds before sending them to your school?", o:["To make them smell nicer","Wet grounds can grow mould","To change their colour"], a:1, why:"Damp grounds trap moisture, and mould loves that. Drying keeps them fresh and safe to use."},
    {q:"What is a good sign your kit grounds are still fine to use?", o:["They clump together when squeezed","They feel crumbly and smell normal","They look fuzzy"], a:1, why:"Crumbly means no water has got in. Fuzzy or damp grounds mean mould, so tell your teacher."},
    {q:"Where should you keep your kit container?", o:["Somewhere damp","A dry spot with the lid closed","In the sun with the lid off"], a:1, why:"Keeping the lid on and the spot dry stops moisture getting back in."},
    {q:"Used coffee grounds added to soil mostly give plants…", o:["Nitrogen","Sunlight","Salt"], a:0, why:"Grounds are a source of nitrogen, a nutrient plants use to grow leaves."},
    {q:"How much grounds should you mix into soil for a seedling?", o:["All grounds, no soil","About one part grounds to four parts soil","None, never mix them"], a:1, why:"Too much can pack down and hold water. A small share works best."},
    {q:"Why do coffee-ground sachets help a smelly shoe?", o:["Dried grounds soak up smells","They make the shoe warmer","They add a strong perfume"], a:0, why:"Dried grounds are full of tiny pores that trap smelly molecules, so they absorb odours instead of covering them up."},
    {q:"What happens to food waste like coffee grounds buried in a landfill?", o:["Nothing at all","It rots without air and releases methane","It turns straight into clean soil"], a:1, why:"Without air, food waste breaks down slowly and gives off methane, a strong greenhouse gas."},
    {q:"Singapore's only landfill, on Pulau Semakau, is expected to be full by about…", o:["2035","2100","It will never fill up"], a:0, why:"At today's rate Semakau Landfill is expected to fill up around 2035. Reusing things helps it last longer."},
    {q:"In \"reduce, reuse, recycle\", which comes first because it stops waste before it starts?", o:["Recycle","Reuse","Reduce"], a:2, why:"Reducing means the waste is never made. Reusing comes next, and recycling is the last of the three."},
    {q:"Your coffee paint looks too pale. What should you do?", o:["Add more water","Steep more grounds in it","Put it in the fridge"], a:1, why:"More grounds in the same water makes a stronger, darker brown."}
  ],

  accessories: [
    {id:"cap",  name:"Cap",         slot:"head", how:"buy", cost:20},
    {id:"glasses", name:"Glasses",  slot:"face", how:"buy", cost:30},
    {id:"scarf",name:"Scarf",       slot:"neck", how:"buy", cost:25},
    {id:"crown",name:"Streak crown",slot:"head", how:"streak", need:7, hint:"Reach a 7-day streak"},
    {id:"sproutHat",name:"Sprout hat",slot:"head", how:"project", need:1, hint:"Finish your first project"},
    {id:"medal",name:"Mission medal",slot:"neck", how:"mission", need:1, hint:"Help your class finish a mission"}
  ],

  schools:[
    {id:"s1",name:"Sungei Rimba Secondary School",cohort:"2026 A",classes:3,students:68,kg:212,active:91,flagged:2,last:"today"},
    {id:"s2",name:"Pelita Hills Secondary School",cohort:"2026 A",classes:2,students:49,kg:158,active:84,flagged:0,last:"today"},
    {id:"s3",name:"Bukit Teratai Secondary School",cohort:"2026 B",classes:4,students:97,kg:276,active:72,flagged:5,last:"2 days ago"},
    {id:"s4",name:"Tanjong Merlin Secondary School",cohort:"2026 B",classes:2,students:51,kg:94,active:58,flagged:1,last:"4 days ago"}
  ],
  batches:[
    {id:"B-1042",school:"s1",kg:96,cohort:"2026 A",outlet:"DBS Asia Hub",events:[
      ["2026-09-02","Collected from the CoffeeBot machine at DBS Asia Hub","ok"],["2026-09-03","Dried, then sealed in kit containers","ok"],
      ["2026-09-08","Delivered to Sungei Rimba Secondary School","ok"],["2026-09-20","Kit opened by Sungei Rimba Secondary School, Sec 1A","ok"],
      ["2026-10-12","Used in seedling projects, 96 kg verified","ok"]]},
    {id:"B-1043",school:"s2",kg:158,cohort:"2026 A",outlet:"SMU School of Law",events:[
      ["2026-09-05","Collected from the CoffeeBot machine at SMU School of Law","ok"],["2026-09-06","Dried, then sealed in kit containers","ok"],
      ["2026-09-12","Delivered to Pelita Hills Secondary School","ok"],["2026-10-20","Used in garden beds, 158 kg verified","ok"]]},
    {id:"B-1051",school:"s3",kg:276,cohort:"2026 B",outlet:"DBS Asia Central",events:[
      ["2026-10-01","Collected from the CoffeeBot machine at DBS Asia Central","ok"],["2026-10-02","Dried, then sealed in kit containers","ok"],
      ["2026-10-09","Delivered to Bukit Teratai Secondary School","ok"],["pending","Awaiting verification of 40 kg","wait"]]},
    {id:"B-1052",school:"s4",kg:94,cohort:"2026 B",outlet:"DBS Asia Hub",events:[
      ["2026-10-01","Collected from the CoffeeBot machine at DBS Asia Hub","ok"],["2026-10-10","Delivered to Tanjong Merlin Secondary School","ok"],["pending","Kits with students","wait"]]}
  ]
};
