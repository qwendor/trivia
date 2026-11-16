/* SHRM TRIVIA NIGHT - the official Fall 2026 question set, in order.
   Five rounds of five. Each question: { q, a:[A,B,C,D], c: index of the correct option }.
   Option order is kept exactly as written on the e-board answer sheet.
   Three tiebreakers at the bottom are only used when two people finish on the same score. */
(function () {
  "use strict";

  var ROUNDS = [
    {
      n: 1, name: "HR Basics", diff: "Easy", color: "sky", t: 20,
      qs: [
        { q: "What does HR stand for?", a: ["Human Relations", "Human Resources", "Hiring Representatives", "Human Recruitment"], c: 1 },
        { q: "What is the primary responsibility of a Human Resources department?", a: ["Managing company finances", "Selling company products", "Managing employees and workplace practices", "Handling customer complaints"], c: 2 },
        { q: "What does onboarding mean?", a: ["Training and integrating new employees into an organization", "Terminating employees", "Conducting exit interviews", "Recruiting external candidates"], c: 0 },
        { q: "What is employee turnover?", a: ["The number of employees receiving promotions", "The number of employees leaving an organization", "The number of employees working overtime", "The number of employees hired each month"], c: 1 },
        { q: "What does DEI stand for?", a: ["Development, Education, and Inclusion", "Diversity, Equity, and Inclusion", "Diversity, Employment, and Integration", "Department, Equality, and Innovation"], c: 1 }
      ]
    },
    {
      n: 2, name: "Employment Law", diff: "Medium", color: "gold", t: 20,
      qs: [
        { q: "Which federal law prohibits employment discrimination based on race, color, religion, sex, and national origin?", a: ["Fair Labor Standards Act", "Title VII of the Civil Rights Act of 1964", "Family and Medical Leave Act", "Occupational Safety and Health Act"], c: 1 },
        { q: "What does FMLA stand for?", a: ["Federal Medical Leave Agreement", "Family and Medical Leave Act", "Fair Management Labor Act", "Family Management Leave Agreement"], c: 1 },
        { q: "The Age Discrimination in Employment Act (ADEA) generally protects employees and applicants who are what age or older?", a: ["35", "40", "45", "50"], c: 1 },
        { q: "Which government agency enforces federal employment discrimination laws?", a: ["IRS", "FBI", "EEOC", "FTC"], c: 2 },
        { q: "What is the current federal minimum wage in the United States?", a: ["$7.25", "$9.50", "$12.00", "$15.00"], c: 0 }
      ]
    },
    {
      n: 3, name: "Recruiting & Talent Acquisition", diff: "Medium", color: "gold", t: 20,
      qs: [
        { q: "What does ATS stand for in recruiting?", a: ["Applicant Tracking System", "Automated Training Software", "Application Testing Service", "Advanced Talent Strategy"], c: 0 },
        { q: "What is the primary purpose of a job description?", a: ["Explain company vacation policies", "Outline job responsibilities and qualifications", "Determine employee bonuses", "Track employee attendance"], c: 1 },
        { q: "What is an internal hire?", a: ["Hiring someone from another company", "Hiring someone who already works for the organization", "Hiring a temporary employee", "Hiring an independent contractor"], c: 1 },
        { q: "What does employer branding describe?", a: ["A company's logo and colors", "How an organization is perceived as a place to work", "How a company markets its products", "Its financial reputation"], c: 1 },
        { q: "What is the primary purpose of an exit interview?", a: ["Negotiate an employee's salary", "Understand why an employee is leaving and gather feedback", "Determine an employee's next promotion", "Recruit a replacement immediately"], c: 1 }
      ]
    },
    {
      n: 4, name: "Workplace Scenarios", diff: "Challenging", color: "melon", t: 30,
      qs: [
        { q: "An employee reports that their manager is making inappropriate comments. What should HR do first?", a: ["Ignore the complaint", "Immediately fire the manager", "Take the complaint seriously and begin an appropriate investigation", "Tell the employee to confront the manager"], c: 2 },
        { q: "Two employees are having a disagreement that is affecting their work. What should HR encourage?", a: ["Open communication and conflict resolution", "Immediate termination", "Ignoring the situation", "Transferring both employees"], c: 0 },
        { q: "An employee consistently arrives late to work. What is the best initial response from their manager?", a: ["Immediately terminate the employee", "Discuss the attendance issue and clarify expectations", "Reduce their salary", "Ignore the issue"], c: 1 },
        { q: "A company wants to improve employee retention. Which strategy would likely help the most?", a: ["Reducing employee communication", "Offering professional development and growth opportunities", "Increasing employee workloads", "Eliminating performance reviews"], c: 1 },
        { q: "An employee shares a coworker's confidential medical information with the entire department. What should HR do?", a: ["Ignore the situation", "Review the situation, investigate appropriately, and address confidentiality concerns", "Immediately reduce the employee's pay", "Share the information with other managers"], c: 1 }
      ]
    },
    {
      n: 5, name: "Fun HR & Workplace Trivia", diff: "Fun round", color: "lav", t: 20,
      qs: [
        { q: "What does PTO stand for?", a: ["Paid Time Off", "Personal Training Opportunity", "Professional Time Organization", "Paid Training Option"], c: 0 },
        { q: "What is an employee who works entirely from home commonly called?", a: ["Hybrid employee", "Remote employee", "Contract employee", "Seasonal employee"], c: 1 },
        { q: "What is another common name for an employee performance evaluation?", a: ["Exit interview", "Performance review", "Onboarding", "Job analysis"], c: 1 },
        { q: "Which generation is generally associated with people born between 1997 and 2012?", a: ["Millennials", "Generation X", "Generation Z", "Baby Boomers"], c: 2 },
        { q: "What is the purpose of a workplace dress code?", a: ["Determine employee salaries", "Establish expectations for appropriate workplace attire", "Determine employee benefits", "Evaluate employee performance"], c: 1 }
      ]
    }
  ];

  var TIEBREAKERS = [
    { q: "How many employees must a private-sector employer generally have for Title VII to apply?", a: ["10", "15", "20", "25"], c: 1 },
    { q: "Which federal law establishes federal minimum wage and overtime requirements?", a: ["FMLA", "OSHA", "FLSA", "ADEA"], c: 2 },
    { q: "What does a compa-ratio measure?", a: ["An employee's salary compared with the midpoint of their salary range", "An employee's attendance compared with coworkers", "An employee's performance compared with company goals", "An employee's benefits compared with industry averages"], c: 0 }
  ];

  function flat(limitOverride) {
    var out = [];
    ROUNDS.forEach(function (r) {
      r.qs.forEach(function (src, i) {
        out.push({
          round: r.n, roundName: r.name, diff: r.diff, color: r.color, first: i === 0,
          cat: "Round " + r.n, tag: r.name,
          q: src.q, a: src.a.slice(), c: src.c, t: limitOverride || r.t
        });
      });
    });
    return out;
  }
  function tiebreaker(i, limitOverride) {
    var src = TIEBREAKERS[i]; if (!src) return null;
    return { round: 0, roundName: "Tiebreaker", diff: "Sudden death", color: "melon", first: i === 0, tiebreak: true,
      cat: "Tiebreaker", tag: "Only if it's tied", q: src.q, a: src.a.slice(), c: src.c, t: limitOverride || 20 };
  }

  window.QUESTIONS = { ROUNDS: ROUNDS, TIEBREAKERS: TIEBREAKERS, flat: flat, tiebreaker: tiebreaker };
})();
