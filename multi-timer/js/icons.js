/* Multi Timer — curated Font Awesome (solid, free) icon set with search keywords */
window.MT = window.MT || {};
(function (MT) {
  const raw = `
briefcase:work job office|laptop:work computer|laptop-code:code dev programming|computer:pc desktop|keyboard:typing
book:study read|book-open:study read|graduation-cap:study school exam|pen:write|pencil:write draw|pen-nib:design
paintbrush:paint art|palette:paint art color|code:dev programming|terminal:dev console|bug:debug test qa
flask:science lab|microscope:science|calculator:math|chart-line:stats|chart-pie:stats|clipboard-list:tasks todo
list-check:tasks todo checklist|circle-check:done|square-check:done|calendar:date|calendar-days:date|clock:time
stopwatch:timer|hourglass-half:timer wait|hourglass-start:timer|bell:alarm alert|mug-hot:coffee tea break
mug-saucer:coffee break|utensils:meal food eat lunch dinner|bowl-food:meal food|bowl-rice:meal food|pizza-slice:food
burger:food|egg:egg cook|carrot:vegetable cook|apple-whole:fruit snack|lemon:fruit|cookie:snack|cake-candles:cake bake birthday
ice-cream:dessert|wine-glass:drink|martini-glass:drink|glass-water:drink water hydrate|bottle-water:drink water
blender:cook|kitchen-set:cook kitchen|fire-burner:cook stove|bed:sleep nap rest|moon:night sleep|sun:day morning
cloud:weather|bath:bath shower|shower:shower bath|soap:wash clean|pump-soap:skincare wash|tooth:teeth brush dental
spa:skincare relax|hand-sparkles:skincare clean|face-smile:happy|face-grin:happy|face-laugh:fun|heart:love health
heart-pulse:health cardio|brain:focus think|dumbbell:gym workout exercise|person-running:run exercise|person-walking:walk
person-biking:bike cycle|person-swimming:swim|person-hiking:hike|bicycle:bike|football:sport|basketball:sport
volleyball:sport|table-tennis-paddle-ball:sport|baseball:sport|golf-ball-tee:sport golf|chess:game strategy
chess-knight:game|dice:game|gamepad:game play|puzzle-piece:puzzle game|headphones:music listen podcast|music:music
guitar:music practice|microphone:sing record|film:movie watch|tv:watch series|video:video watch|camera:photo
image:photo|newspaper:news read|person-praying:pray|hands-praying:pray|mosque:pray|star:favorite|star-and-crescent:ramadan
house:home|couch:relax home|broom:clean sweep|spray-can-sparkles:clean|shirt:laundry clothes|socks:laundry clothes
vest:clothes|shoe-prints:walk|trash:trash garbage|recycle:recycle|seedling:plant garden|leaf:plant nature|tree:nature
dog:pet walk|cat:pet|paw:pet|fish:pet food|horse:animal|dove:peace|car:drive|car-side:drive|bus:commute|train:commute
plane:travel flight|ship:travel|motorcycle:ride|gas-pump:fuel|cart-shopping:shopping|basket-shopping:shopping groceries
bag-shopping:shopping|store:shop|money-bill:money pay|wallet:money|coins:money|credit-card:pay|piggy-bank:save money
dollar-sign:money|receipt:bill|gift:gift|phone:call|envelope:mail email|comments:chat talk|message:chat|user:person
users:people team meeting|baby:baby kid|child:kid|people-group:team meeting|handshake:meeting deal|pills:medicine
syringe:medicine|stethoscope:doctor|kit-medical:first aid|hospital:doctor|eye:eyes rest|glasses:read|fire:hot burn
bolt:energy power|droplet:water|snowflake:cold freeze|umbrella:rain|temperature-half:temperature|wind:air|mountain:hike
water:water|rocket:launch fast|flag:goal|flag-checkered:finish race|trophy:win|medal:win|award:win|crown:king
gem:value|key:key|lock:lock focus|wrench:fix repair|screwdriver-wrench:fix tools|hammer:build|toolbox:tools
gear:settings|gears:process|lightbulb:idea|plug:charge|battery-full:charge|wifi:internet|globe:world web|map:travel
location-dot:place|compass:explore|scissors:cut craft|ruler:measure|box:package|boxes-stacked:storage|truck:delivery
note-sticky:note|file:document|folder:files|print:print|paperclip:attach|person-chalkboard:teach presentation
chalkboard:teach|school:school|language:language learn|hand-holding-heart:care|bowl-food:food|wine-bottle:drink
cookie-bite:snack|pepper-hot:spicy cook|drumstick-bite:food chicken|fish-fins:fish|hotdog:food|stroopwafel:snack
ghost:fun|skull:danger|robot:ai bot|satellite:space|meteor:space|shield-heart:protect|spray-can:paint
`;
  const list = [];
  const seen = new Set();
  raw.split(/[|\n]/).forEach((part) => {
    const p = part.trim();
    if (!p) return;
    const [name, kw = ""] = p.split(":");
    if (seen.has(name)) return;
    seen.add(name);
    list.push({ name, keywords: (name.replace(/-/g, " ") + " " + kw).toLowerCase() });
  });
  MT.icons = {
    list,
    search(q) {
      q = (q || "").trim().toLowerCase();
      if (!q) return list;
      const words = q.split(/\s+/);
      return list.filter((i) => words.every((w) => i.keywords.includes(w)));
    },
    /** Picks an icon from a timer name (used by spreadsheet import when no Icon column). */
    guess(name) {
      const n = String(name || "").toLowerCase();
      const map = [
        [/laundr|wash|cloth/, "shirt"], [/skin|face|serum|mask/, "spa"], [/teeth|tooth|brush/, "tooth"],
        [/shower|bath/, "shower"], [/work|job|office/, "briefcase"], [/focus|deep/, "brain"],
        [/study|learn|lesson|course|basics|operator|function|array|object|control flow/, "book-open"],
        [/code|dev|program/, "laptop-code"], [/read|book/, "book"], [/egg/, "egg"], [/bak|cake|oven/, "cake-candles"],
        [/cook|meal|lunch|dinner|breakfast|food/, "utensils"], [/coffee|tea|drink/, "mug-hot"], [/water|hydrat/, "glass-water"],
        [/nap|sleep|bed/, "bed"], [/rest|break|relax/, "couch"], [/clean|tidy|sweep/, "broom"], [/shop|grocer/, "cart-shopping"],
        [/walk/, "person-walking"], [/run|jog/, "person-running"], [/gym|workout|exercise|train/, "dumbbell"],
        [/watch|movie|film|tv|series/, "tv"], [/music|guitar|piano/, "music"], [/paint|draw|art/, "palette"],
        [/pray|salah|quran/, "person-praying"], [/meet|call/, "users"], [/med|pill/, "pills"], [/game|play/, "gamepad"],
        [/hobby|hoppy/, "puzzle-piece"], [/pomodoro/, "stopwatch"], [/checklist|go live|launch/, "list-check"],
      ];
      for (const [re, icon] of map) if (re.test(n)) return icon;
      return "";
    },
    valid(name) {
      return seen.has(String(name || "").replace(/^fa-/, ""));
    },
  };
})(window.MT);
