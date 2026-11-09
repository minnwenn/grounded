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

  // Daily quiz: one question per calendar day, cycling through all of these. Add new questions at the END: a question's position is its id in the database, so saved answers stay valid.
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
    {q:"Your coffee paint looks too pale. What should you do?", o:["Add more water","Steep more grounds in it","Put it in the fridge"], a:1, why:"More grounds in the same water makes a stronger, darker brown."},
    {q:"A circular economy tries to…", o:["Only sell round objects", "Make things, use them once, then throw them away", "Keep materials in use for as long as possible"], a:2, why:"In a circular economy products and materials are reused, repaired and recycled, so very little becomes waste. The opposite is a linear \"take, make, throw away\" economy."},
    {q:"Why are used coffee grounds good to add to a compost bin?", o:["They make the compost smell like coffee", "They add nitrogen-rich material", "They stop other waste from rotting"], a:1, why:"Grounds count as a \"green\" compost material because they are rich in nitrogen, even though they look brown. Mixed with dry \"brown\" material they help the tiny microbes that make compost."},
    {q:"Which of these is a renewable source of energy?", o:["Natural gas", "Coal", "Solar power"], a:2, why:"Sunlight arrives every day, so it will not run out. Coal and gas took millions of years to form and we are using them up much faster than they form."},
    {q:"Counting everything from the farm to the cup, about how much water does one cup of coffee use?", o:["About 140 litres", "About 1 litre", "About 2 spoonfuls"], a:0, why:"Most of it is the water used to grow the coffee plant. This hidden \"water footprint\" is a reminder that everyday things cost resources before we ever see them."},
    {q:"What should you NOT do with leftover wet coffee grounds?", o:["Wash a lot of them down the sink", "Dry them out before storing them", "Spread a thin layer on soil"], a:0, why:"Grounds clump together and can block pipes. Put them in compost or dry them for projects instead."},
    {q:"What is the BEST way to deal with food waste?", o:["Burn it", "Bury it in a landfill", "Stop it being wasted in the first place"], a:2, why:"Preventing waste saves the water, energy and land that went into the food. Composting is good, but not wasting it is better."},
    {q:"Turning old jeans into a bag is an example of…", o:["Pollution", "Upcycling", "Composting"], a:1, why:"Upcycling turns something unwanted into something new that is just as useful, or more valuable. Recycling usually breaks a thing down into raw material first."},
    {q:"How many Sustainable Development Goals did the United Nations set for 2030?", o:["70", "7", "17"], a:2, why:"The 17 goals cover things like clean water, climate action and responsible consumption, and all countries agreed to work on them."},
    {q:"Why can coffee be used as a natural paint?", o:["It is made from paint", "It contains glue", "Its brown colour stains paper"], a:2, why:"Many plants make coloured compounds that stain whatever they touch. People have used coffee and tea as dyes for hundreds of years."},
    {q:"What is a carbon footprint?", o:["The weight of carbon in your body", "A mark a shoe leaves in the soil", "The greenhouse gases caused by an activity or product"], a:2, why:"It adds up the greenhouse gases made by things like travel, food and products, so we can see which choices cause more climate change."},
    {q:"What does \"closed loop\" mean for materials?", o:["Waste from one process becomes the input for another", "A factory with its doors closed", "A recycling bin with a lid"], a:0, why:"In a closed loop nothing is thrown away: the leftovers of one process become the raw material of the next, like grounds becoming compost."},
    {q:"Which sustainable habit could you try this week?", o:["Bring my own bottle or cup", "Switch off lights and fans when I leave a room", "Finish all the food on my plate"], a:-1, why:"Any of these helps. Small habits add up, especially when a whole class does them together."},
    {q:"Why does Singapore burn most of its rubbish in waste-to-energy plants before using Semakau Landfill?", o:["It is the cheapest way to recycle plastic", "It makes the waste disappear with no side effects", "It shrinks the waste a lot, and the heat makes electricity"], a:2, why:"Burning cuts the volume of waste so the landfill lasts longer. The ash still goes to Semakau, so making less waste in the first place matters most."},
    {q:"Where else can used coffee grounds go instead of the bin?", o:["Mushroom farms and compost makers", "Swimming pools", "Aeroplane engines"], a:0, why:"Mushrooms grow well on grounds, and compost makers and biofuel makers use them too. Treating grounds as a resource instead of waste is circular thinking."},
    {q:"Microplastics are…", o:["Plastic pieces smaller than 5 mm", "Plastic that dissolves in water", "Plastic made from plants"], a:0, why:"They come from bigger plastics breaking down, and from tiny beads in some products. They end up in oceans, in animals and even in our food."},
    {q:"SDG 12 is about…", o:["Faster internet", "Responsible consumption and production", "Exploring space"], a:1, why:"It asks us to make and use things in ways that waste less, which is what reducing, reusing and recycling are all about."},
    {q:"A company calls its bottle \"eco-friendly\" but gives no proof. This could be…", o:["Greenwashing", "Upcycling", "Composting"], a:0, why:"Greenwashing is making something sound greener than it really is. Look for real facts, numbers and trusted labels."},
    {q:"Why can repairing a phone help the planet more than recycling it?", o:["Phones cannot be recycled", "Repaired phones use no electricity", "The whole product keeps working, so no new materials or energy are needed"], a:2, why:"Recycling breaks a product down and then needs energy to make a new one. Repairing keeps everything that is already made in use."},
    {q:"Before putting a plastic bottle in the recycling bin, you should…", o:["Empty and rinse it", "Leave some drink inside", "Fill it with water"], a:0, why:"Food and drink left inside can dirty other recyclables, and a dirty batch may not get recycled at all."},
    {q:"Why is a coffee-ground scrub good to use gently on hands?", o:["Grounds are sticky", "Grounds dissolve completely in water", "The tiny gritty bits lift dead skin without being sharp"], a:2, why:"Rub lightly and rinse well. Do a small patch test first, and never use a scrub on cuts or sore skin."},
    {q:"Which of these is an example of a linear economy?", o:["Turning grounds into compost", "Repairing a broken bicycle", "Make a product, use it once, then throw it away"], a:2, why:"A linear economy goes in a straight line from taking resources to making waste. A circular economy brings things back around."},
    {q:"The Paris Agreement aims to keep global warming…", o:["Well below 2°C, and ideally 1.5°C, above pre-industrial levels", "At exactly today's level, with no limit", "Below 20°C"], a:0, why:"Countries agreed on these limits in 2015 because every extra bit of warming makes floods, heatwaves and storms worse."},
    {q:"What is a \"carbon sink\"?", o:["A pipe that carries smoke", "Something that absorbs more carbon dioxide than it releases, like a forest", "A sink full of coal"], a:1, why:"Forests, oceans and soil soak up carbon dioxide. Protecting them helps slow climate change."},
    {q:"Why do many disposable coffee cups end up in the bin instead of being recycled?", o:["A thin plastic lining is hard to separate from the paper", "Cups are not allowed in recycling by law", "The cups are made of metal"], a:0, why:"The lining keeps the drink in, but it makes recycling harder. A reusable cup avoids the problem."},
    {q:"\"Net zero\" emissions means…", o:["Emissions are cut by half", "No greenhouse gas is ever made", "Greenhouse gases added are balanced by gases taken out"], a:2, why:"Some emissions are hard to avoid, so net zero balances what we add with what forests, soil or technology remove."},
    {q:"A \"biodegradable\" plastic bag will always rot quickly in a normal bin. True or false?", o:["False: many need warm, industrial composting conditions", "True", "True, but only in water"], a:0, why:"Biodegradable does not mean it vanishes anywhere. Check the label, and the best bag is the one you reuse."},
    {q:"Which of these is a \"brown\" material in a compost bin?", o:["Dry leaves", "Coffee grounds", "Fruit peels"], a:0, why:"Browns are dry and carbon-rich, like dry leaves and cardboard. Greens are wet and nitrogen-rich, like peels and coffee grounds. A good compost needs both."},
    {q:"A \"life cycle\" view of a coffee cup looks at…", o:["Every stage, from making the materials to throwing it away", "Just the day you buy it", "Only what it looks like"], a:0, why:"Looking at the whole life cycle shows where the biggest impact is. For many products, that is the making, not the throwing away."},
    {q:"Products made to wear out quickly so people buy new ones are an example of…", o:["Closed-loop design", "Planned obsolescence", "Renewable energy"], a:1, why:"It makes more waste. Choosing products that last, or can be repaired, pushes companies to build things better."},
    {q:"Why can eating local food sometimes help the environment?", o:["Local food has no packaging", "It may travel a shorter distance and use less fuel", "It grows without any water"], a:1, why:"Less transport can mean fewer emissions, but how the food is grown matters too, so it is only one part of the picture."},
    {q:"Singapore imports most of its food. What is the \"30 by 30\" goal?", o:["Plant 30 trees in 30 days", "Cut all waste by 30% in 30 years", "Grow 30% of our nutritional needs locally by 2030"], a:2, why:"Growing more food at home makes Singapore less dependent on imports, and a shorter journey can also mean fewer emissions."},
    {q:"Sharing a power drill with your neighbours, instead of everyone buying one, is part of…", o:["Planned obsolescence", "The sharing economy", "Greenwashing"], a:1, why:"Most drills are used for only minutes in their whole life. Sharing means fewer things need to be made."},
    {q:"What is e-waste?", o:["Old electronics like phones, chargers and laptops", "Waste made only by electricity", "Emails you delete"], a:0, why:"E-waste holds metals worth recovering, and harmful materials that must not go in the normal bin. Use proper e-waste collection points."},
    {q:"Recycling a plastic bottle into a lower-quality product, like a plastic bench, is sometimes called…", o:["Overcycling", "Downcycling", "Upcycling"], a:1, why:"The material loses quality each time it is recycled, so it can only be recycled a few times. That is why reducing and reusing come first."},
    {q:"Which light bulb uses the least electricity for the same brightness?", o:["They all use the same", "An LED bulb", "An old-style filament bulb"], a:1, why:"LEDs turn most of their energy into light, not heat. They also last much longer, so fewer bulbs are thrown away."},
    {q:"Why is wasting food also wasting other things?", o:["It only wastes the packaging", "Food waste is free to make", "Water, energy and land were used to grow and move it"], a:2, why:"When a meal is thrown away, so is everything used to grow, process, transport and cook it."},
    {q:"Which question could you ask before buying something new?", o:["Do I really need it?", "Can I borrow, repair or buy it second-hand?", "Will I still use it in a year?"], a:-1, why:"All three are good questions. Asking before you buy is the \"reduce\" in reduce, reuse, recycle."},
    {q:"Which habit saves the most water at home?", o:["Taking shorter showers", "Leaving the tap running while you brush", "Washing a half-empty load every day"], a:0, why:"Showers and washing use a lot of water. Small changes repeated every day add up to a big saving."},
    {q:"Why does clearing rainforest to grow crops harm the planet?", o:["Many animals and plants lose their homes", "Trees get too much sunlight", "The soil gets too much shade"], a:0, why:"Rainforests hold huge numbers of species. Shade-grown coffee, grown under trees, can protect more wildlife than clearing the land."},
    {q:"CoffeeBot collects grounds from offices and sends them to schools. This is an example of…", o:["A circular economy loop", "A linear economy", "Greenwashing"], a:0, why:"Grounds that would have been thrown away become a material for projects and compost, so they stay useful instead of ending up in landfill."}
  ],

  // The plants a student can choose from after finishing a project. The pictures are drawn in js/garden.js.
  plants: [
    {id:"sunflower",  name:"Sunflower",   blurb:"Tall and sunny. Its big golden head turns to follow the light."},
    {id:"orchid",     name:"Orchid",      blurb:"Singapore's national flower is an orchid, the Vanda Miss Joaquim."},
    {id:"hibiscus",   name:"Hibiscus",    blurb:"Big red flowers. In some places it is called the shoe flower, because it was used to polish shoes."},
    {id:"chilli",     name:"Chilli padi", blurb:"A tiny chilli with a big kick, loved in Singapore cooking."},
    {id:"pandan",     name:"Pandan",      blurb:"Fragrant leaves that flavour many local cakes and desserts."},
    {id:"frangipani", name:"Frangipani",  blurb:"A small tree with sweet-smelling white and yellow flowers."},
    {id:"tomato",     name:"Tomato",      blurb:"Watch its fruit change from green to red as it ripens."},
    {id:"raintree",   name:"Rain tree",   blurb:"The big shady trees along many Singapore roads. Yours starts as a sapling."}
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
