/* SHRM TRIVIA NIGHT - question packs.
   Each question: { q, a:[4 options], c: index of the correct option, t: seconds (optional) }
   Options are shuffled when a game is built, so the correct one can sit anywhere on screen. */
(function () {
  "use strict";

  var PACKS = [
    {
      id: "hr", name: "HR & Work", tag: "The SHRM round", color: "gold",
      qs: [
        { q: "What does SHRM stand for?", a: ["Society for Human Resource Management", "Standards for Hiring, Recruiting & Management", "Society of Human Relations Managers", "Strategic HR Monitoring"], c: 0 },
        { q: "Which U.S. law sets the federal minimum wage and overtime pay rules?", a: ["Fair Labor Standards Act", "Family and Medical Leave Act", "Civil Rights Act", "Occupational Safety and Health Act"], c: 0 },
        { q: "FMLA gives eligible employees up to how many weeks of unpaid, job-protected leave per year?", a: ["12 weeks", "4 weeks", "26 weeks", "6 weeks"], c: 0 },
        { q: "The EEOC enforces federal laws against workplace...", a: ["Discrimination", "Theft", "Unpaid overtime", "Unsafe machinery"], c: 0 },
        { q: "What does PTO stand for?", a: ["Paid time off", "Personal task order", "Part-time only", "Payroll tax obligation"], c: 0 },
        { q: "A 401(k) is a type of...", a: ["Retirement savings plan", "Health insurance plan", "Tax form", "Performance review"], c: 0 },
        { q: "Which of these is NOT a protected class under Title VII of the Civil Rights Act of 1964?", a: ["Age", "Race", "Religion", "National origin"], c: 0 },
        { q: "What does ADA stand for?", a: ["Americans with Disabilities Act", "Annual Discrimination Audit", "Age Discrimination Act", "American Diversity Alliance"], c: 0 },
        { q: "\"Onboarding\" is the process of...", a: ["Bringing a new hire into the team", "Laying off employees", "Boarding a company flight", "Reviewing yearly pay"], c: 0 },
        { q: "What is the current U.S. federal minimum wage?", a: ["$7.25", "$10.00", "$12.50", "$15.00"], c: 0 },
        { q: "OSHA is the federal agency for...", a: ["Workplace safety and health", "Payroll taxes", "Union elections", "Immigration paperwork"], c: 0 },
        { q: "Which form do new U.S. employees fill out to set their federal tax withholding?", a: ["W-4", "W-2", "I-9", "1099"], c: 0 },
        { q: "Which form verifies a new hire's identity and eligibility to work in the U.S.?", a: ["I-9", "W-4", "W-9", "1040"], c: 0 },
        { q: "\"Quiet quitting\" means...", a: ["Doing only what the job requires, nothing extra", "Resigning without telling anyone", "Working from home in silence", "Leaving a meeting early"], c: 0 },
        { q: "Which of these is a \"soft skill\"?", a: ["Communication", "Excel formulas", "Python", "Forklift certification"], c: 0 },
        { q: "The HR term for the rate at which employees leave a company is...", a: ["Turnover", "Churn-up", "Rollover", "Spillage"], c: 0 },
        { q: "\"At-will employment\" means...", a: ["Either side can end the job at any time, for any legal reason", "You can only be fired for cause", "Employees pick their own hours", "Contracts renew every year"], c: 0 },
        { q: "SHRM's national headquarters is in which Virginia city?", a: ["Alexandria", "Richmond", "Norfolk", "Roanoke"], c: 0 },
        { q: "An exit interview happens when an employee...", a: ["Leaves the company", "Gets promoted", "Finishes onboarding", "Takes parental leave"], c: 0 },
        { q: "The STAR method (Situation, Task, Action, Result) is used for...", a: ["Answering behavioral interview questions", "Calculating overtime", "Writing a resignation letter", "Rating job postings"], c: 0 },
        { q: "What does KPI stand for?", a: ["Key performance indicator", "Known personnel issue", "Keep people informed", "Kinetic pay increase"], c: 0 },
        { q: "A \"non-compete\" clause restricts an employee from...", a: ["Working for a rival after leaving", "Taking vacation in Q4", "Talking to the press", "Applying for a promotion"], c: 0 }
      ]
    },
    {
      id: "vcu", name: "VCU & Richmond", tag: "Hometown round", color: "sky",
      qs: [
        { q: "What is the name of VCU's mascot?", a: ["Rodney the Ram", "Rocky the Ram", "Ramsey", "Rollo"], c: 0 },
        { q: "VCU's official colors are...", a: ["Black and gold", "Navy and gold", "Black and green", "Maroon and gold"], c: 0 },
        { q: "VCU was formed in 1968 by merging the Medical College of Virginia with...", a: ["Richmond Professional Institute", "Virginia Union University", "Richmond Technical College", "The College of William & Mary"], c: 0 },
        { q: "In 2011, VCU men's basketball made a legendary run to the...", a: ["Final Four", "Sweet Sixteen", "National Championship game", "Elite Eight"], c: 0 },
        { q: "Which river runs through Richmond?", a: ["James River", "Potomac River", "Rappahannock River", "York River"], c: 0 },
        { q: "VCU's School of Business is housed in which building?", a: ["Snead Hall", "Cabell Hall", "Hibbs Hall", "Grace Hall"], c: 0 },
        { q: "VCU's basketball arena is called the...", a: ["Siegel Center", "Robins Center", "Richmond Coliseum", "Ram Dome"], c: 0 },
        { q: "The three-letter nickname for Richmond, Virginia is...", a: ["RVA", "RIC", "RVC", "RMD"], c: 0 },
        { q: "VCU's full-court-press style under coach Shaka Smart was nicknamed...", a: ["Havoc", "Chaos", "The Storm", "Mayhem"], c: 0 },
        { q: "VCU's main library on the Monroe Park campus is named...", a: ["James Branch Cabell Library", "Tompkins-McCaw Library", "Snead Library", "Rodney Reading Room"], c: 0 },
        { q: "The open plaza in the middle of VCU's Monroe Park campus is called...", a: ["The Compass", "The Quad", "Ram Square", "The Commons Lawn"], c: 0 },
        { q: "Richmond is the capital of which U.S. state?", a: ["Virginia", "West Virginia", "North Carolina", "Maryland"], c: 0 },
        { q: "Virginia's state flower (and state tree) is the...", a: ["Dogwood", "Magnolia", "Cherry blossom", "Oak"], c: 0 },
        { q: "VCU's athletic conference is the...", a: ["Atlantic 10", "ACC", "Big East", "CAA"], c: 0 },
        { q: "VCU's two main campuses are Monroe Park and...", a: ["MCV", "Rice Rivers", "Carytown", "Scott's Addition"], c: 0 }
      ]
    },
    {
      id: "biz", name: "Business", tag: "Snead Hall round", color: "lav",
      qs: [
        { q: "What does CEO stand for?", a: ["Chief Executive Officer", "Central Executive Operator", "Chief Earnings Officer", "Corporate Executive Owner"], c: 0 },
        { q: "Who founded Amazon?", a: ["Jeff Bezos", "Elon Musk", "Bill Gates", "Steve Jobs"], c: 0 },
        { q: "The \"Big Four\" accounting firms are Deloitte, PwC, EY and...", a: ["KPMG", "BDO", "Grant Thornton", "Accenture"], c: 0 },
        { q: "What does B2B mean?", a: ["Business to business", "Back to basics", "Buy two, bargain", "Brand to buyer"], c: 0 },
        { q: "The NYSE and NASDAQ are both...", a: ["Stock exchanges", "Credit bureaus", "Federal banks", "Accounting standards"], c: 0 },
        { q: "Which company's slogan is \"Just Do It\"?", a: ["Nike", "Adidas", "Under Armour", "Puma"], c: 0 },
        { q: "What does ROI stand for?", a: ["Return on investment", "Rate of inflation", "Revenue over income", "Risk of insolvency"], c: 0 },
        { q: "LinkedIn is owned by which company?", a: ["Microsoft", "Google", "Meta", "Salesforce"], c: 0 },
        { q: "In business, \"Q4\" refers to...", a: ["The fourth quarter of the year", "Four key questions", "A quality rating", "A four-year plan"], c: 0 },
        { q: "In startup slang, a \"unicorn\" is a private company valued at over...", a: ["$1 billion", "$1 million", "$100 million", "$10 billion"], c: 0 },
        { q: "What does the \"P\" in P&L statement stand for?", a: ["Profit", "Payroll", "Pricing", "Procurement"], c: 0 },
        { q: "Which framework analyzes Strengths, Weaknesses, Opportunities and Threats?", a: ["SWOT", "SMART", "STAR", "PEST"], c: 0 },
        { q: "What does \"gross pay\" mean on a paycheck?", a: ["Pay before taxes and deductions", "Pay after taxes", "Overtime pay only", "A disgusting salary"], c: 0 }
      ]
    },
    {
      id: "pop", name: "Pop Culture", tag: "Group chat round", color: "melon",
      qs: [
        { q: "Taylor Swift's record-breaking 2023-24 world tour was called...", a: ["The Eras Tour", "The Reputation Tour", "Midnights Live", "The Folklore Tour"], c: 0 },
        { q: "Which streaming service made \"Stranger Things\"?", a: ["Netflix", "Hulu", "HBO Max", "Disney+"], c: 0 },
        { q: "What does \"GOAT\" stand for?", a: ["Greatest of all time", "Going on a trip", "Get out and train", "Game over, all tied"], c: 0 },
        { q: "Which company makes the iPhone?", a: ["Apple", "Samsung", "Google", "Sony"], c: 0 },
        { q: "What year did the first iPhone come out?", a: ["2007", "2005", "2009", "2010"], c: 0 },
        { q: "Which social app introduced \"Reels\"?", a: ["Instagram", "Snapchat", "TikTok", "Twitter"], c: 0 },
        { q: "\"The Big Apple\" is a nickname for which city?", a: ["New York City", "Los Angeles", "Chicago", "Boston"], c: 0 },
        { q: "Which animated movie features Elsa, Anna and Olaf?", a: ["Frozen", "Moana", "Tangled", "Encanto"], c: 0 },
        { q: "Barbie and Oppenheimer both hit theaters on the same weekend in...", a: ["2023", "2021", "2022", "2024"], c: 0 },
        { q: "Beyonce, Kelly Rowland and Michelle Williams were in which group?", a: ["Destiny's Child", "TLC", "The Pussycat Dolls", "Fifth Harmony"], c: 0 },
        { q: "Which video game series stars a plumber named Mario?", a: ["Super Mario", "Sonic", "Zelda", "Pac-Man"], c: 0 },
        { q: "What is the name of Harry Potter's owl?", a: ["Hedwig", "Errol", "Crookshanks", "Fawkes"], c: 0 },
        { q: "\"Wakanda Forever\" is a line from which franchise?", a: ["Black Panther", "Avatar", "Star Wars", "Fast & Furious"], c: 0 },
        { q: "Which rapper released the album \"Scorpion\"?", a: ["Drake", "Kendrick Lamar", "Travis Scott", "J. Cole"], c: 0 }
      ]
    },
    {
      id: "gen", name: "General Knowledge", tag: "All majors welcome", color: "cream",
      qs: [
        { q: "Which planet is known as the Red Planet?", a: ["Mars", "Venus", "Jupiter", "Mercury"], c: 0 },
        { q: "How many sides does a hexagon have?", a: ["6", "5", "7", "8"], c: 0 },
        { q: "Who painted the Mona Lisa?", a: ["Leonardo da Vinci", "Michelangelo", "Pablo Picasso", "Vincent van Gogh"], c: 0 },
        { q: "What is the largest ocean on Earth?", a: ["Pacific", "Atlantic", "Indian", "Arctic"], c: 0 },
        { q: "What is the capital of Canada?", a: ["Ottawa", "Toronto", "Vancouver", "Montreal"], c: 0 },
        { q: "How many strings does a standard guitar have?", a: ["6", "4", "5", "8"], c: 0 },
        { q: "Which element has the chemical symbol O?", a: ["Oxygen", "Gold", "Osmium", "Hydrogen"], c: 0 },
        { q: "How many minutes are in a full day?", a: ["1,440", "1,240", "1,640", "2,400"], c: 0 },
        { q: "What is the largest living land animal?", a: ["African elephant", "Giraffe", "Hippopotamus", "White rhino"], c: 0 },
        { q: "The Great Pyramid of Giza is in which country?", a: ["Egypt", "Mexico", "Peru", "Sudan"], c: 0 },
        { q: "How many players does each basketball team have on the court at once?", a: ["5", "6", "7", "4"], c: 0 },
        { q: "What is the smallest prime number?", a: ["2", "1", "3", "0"], c: 0 },
        { q: "Which language has the most native speakers in the world?", a: ["Mandarin Chinese", "English", "Spanish", "Hindi"], c: 0 },
        { q: "How many continents are there?", a: ["7", "6", "5", "8"], c: 0 },
        { q: "What is the boiling point of water at sea level, in Fahrenheit?", a: ["212", "100", "180", "300"], c: 0 },
        { q: "Which bone is the longest in the human body?", a: ["Femur", "Tibia", "Humerus", "Spine"], c: 0 }
      ]
    }
  ];

  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = (Math.random() * (i + 1)) | 0, t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  /* Build a game: pick `count` questions spread evenly across the chosen packs,
     shuffle option order, and return plain objects the host can send around. */
  function build(packIds, count, limit) {
    var packs = PACKS.filter(function (p) { return packIds.indexOf(p.id) >= 0; });
    if (!packs.length) packs = PACKS.slice();
    var pools = packs.map(function (p) { return { p: p, qs: shuffle(p.qs) }; });
    var out = [], guard = 0;
    while (out.length < count && guard++ < 1000) {
      var any = false;
      for (var i = 0; i < pools.length && out.length < count; i++) {
        var src = pools[i].qs.shift();
        if (!src) continue;
        any = true;
        var idx = shuffle([0, 1, 2, 3]);
        out.push({
          cat: pools[i].p.name, tag: pools[i].p.tag, color: pools[i].p.color,
          q: src.q,
          a: idx.map(function (k) { return src.a[k]; }),
          c: idx.indexOf(src.c),
          t: src.t || limit || 20
        });
      }
      if (!any) break;
    }
    return shuffle(out);
  }

  window.QUESTIONS = { PACKS: PACKS, build: build, shuffle: shuffle };
})();
