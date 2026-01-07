/**
 * SERA: Self-Evolving Research Agent
 * 
 * A mega-agent combining ALL agent patterns:
 * - ReAct (reasoning + acting)
 * - Reflexion (learning from failures)
 * - Plan-and-Execute (structured planning)
 * - Tree-of-Thoughts (exploring hypotheses)
 * - LATS (Monte Carlo tree search)
 * - Evaluator-Optimizer (quality iteration)
 * - Multi-Agent Orchestrator (specialist coordination)
 * - Memory Systems (episodic, semantic, procedural)
 * - Self-Improving (evolving prompts/tools)
 * - Curriculum Learning (progressive difficulty)
 * - Skill Library (reusable research skills)
 * - Gödel Agent (self-referential improvement)
 * - Experience Replay (learning from history)
 */

import { ToolLoopAgent, tool, generateText, generateObject, stepCountIs } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';

// ============================================
// TYPES
// ============================================

interface ResearchQuestion {
  id: string;
  question: string;
  complexity: number;  // 1-10
  domain: string;
  requiredSkills: string[];
}

interface Hypothesis {
  id: string;
  statement: string;
  confidence: number;
  evidence: string[];
  status: 'exploring' | 'supported' | 'refuted' | 'inconclusive';
}

interface ResearchPlan {
  phases: {
    name: string;
    objectives: string[];
    assignedAgents: string[];
    dependencies: string[];
  }[];
  hypotheses: Hypothesis[];
  estimatedComplexity: number;
}

interface Experience {
  id: string;
  question: ResearchQuestion;
  plan: ResearchPlan;
  trajectory: { agent: string; action: string; result: string; timestamp: Date }[];
  outcome: 'success' | 'partial' | 'failure';
  reflections: string[];
  skillsLearned: string[];
}

interface Skill {
  name: string;
  description: string;
  steps: string[];
  applicableDomains: string[];
  successRate: number;
  usageCount: number;
}

interface AgentPolicy {
  planningStrategy: string;
  hypothesisExploration: string;
  delegationRules: string;
  qualityThresholds: string;
  learningRate: number;
}

// ============================================
// MEMORY SYSTEM (Episodic + Semantic + Procedural)
// ============================================

class SERAMemory {
  // Episodic: Past research experiences
  experiences: Experience[] = [];
  
  // Semantic: Facts and knowledge learned
  knowledge: Map<string, { fact: string; confidence: number; source: string }> = new Map();
  
  // Procedural: Research skills library
  skills: Map<string, Skill> = new Map();
  
  // Working memory for current research
  currentContext: {
    question: ResearchQuestion | null;
    plan: ResearchPlan | null;
    activeHypotheses: Hypothesis[];
    findings: string[];
  } = {
    question: null,
    plan: null,
    activeHypotheses: [],
    findings: [],
  };

  // Add research experience
  addExperience(exp: Experience): void {
    this.experiences.push(exp);
    
    // Extract and store knowledge
    for (const finding of exp.trajectory.filter(t => t.result.includes('FINDING:'))) {
      const fact = finding.result.replace('FINDING:', '').trim();
      this.knowledge.set(`${exp.question.domain}:${Date.now()}`, {
        fact,
        confidence: 0.7,
        source: exp.id,
      });
    }
  }

  // Find similar past experiences
  findSimilarExperiences(question: ResearchQuestion, limit: number = 5): Experience[] {
    return this.experiences
      .filter(e => 
        e.question.domain === question.domain ||
        e.question.requiredSkills.some(s => question.requiredSkills.includes(s))
      )
      .sort((a, b) => {
        // Prioritize successful experiences
        const scoreA = a.outcome === 'success' ? 2 : a.outcome === 'partial' ? 1 : 0;
        const scoreB = b.outcome === 'success' ? 2 : b.outcome === 'partial' ? 1 : 0;
        return scoreB - scoreA;
      })
      .slice(0, limit);
  }

  // Add or update skill
  addSkill(skill: Skill): void {
    const existing = this.skills.get(skill.name);
    if (existing) {
      existing.successRate = (existing.successRate * existing.usageCount + skill.successRate) / (existing.usageCount + 1);
      existing.usageCount++;
    } else {
      this.skills.set(skill.name, skill);
    }
  }

  // Find applicable skills for a task
  findSkills(domain: string, task: string): Skill[] {
    return [...this.skills.values()]
      .filter(s => 
        s.applicableDomains.includes(domain) ||
        s.description.toLowerCase().includes(task.toLowerCase())
      )
      .sort((a, b) => b.successRate - a.successRate);
  }

  // Get knowledge about a topic
  getKnowledge(topic: string): string[] {
    return [...this.knowledge.entries()]
      .filter(([key, _]) => key.toLowerCase().includes(topic.toLowerCase()))
      .map(([_, v]) => v.fact);
  }

  // Generate memory context for prompts
  getContextSummary(): string {
    const recentSuccesses = this.experiences.filter(e => e.outcome === 'success').slice(-3);
    const topSkills = [...this.skills.values()].sort((a, b) => b.successRate - a.successRate).slice(0, 5);
    
    return `
=== SERA Memory Context ===
Total Research Experiences: ${this.experiences.length}
Success Rate: ${(this.experiences.filter(e => e.outcome === 'success').length / Math.max(1, this.experiences.length) * 100).toFixed(1)}%

Recent Successful Research:
${recentSuccesses.map(e => `- ${e.question.question.slice(0, 50)}...`).join('\n')}

Top Research Skills:
${topSkills.map(s => `- ${s.name} (${(s.successRate * 100).toFixed(0)}% success)`).join('\n')}

Current Working Memory:
- Active Question: ${this.currentContext.question?.question || 'None'}
- Active Hypotheses: ${this.currentContext.activeHypotheses.length}
- Findings So Far: ${this.currentContext.findings.length}
`;
  }
}

// ============================================
// SPECIALIST AGENTS (Multi-Agent Pattern)
// ============================================

function createSpecialistAgents(memory: SERAMemory) {
  // Literature Review Specialist
  const literatureAgent = new ToolLoopAgent({
    model: openai('gpt-4o'),
    instructions: `You are a Literature Review Specialist.
Your job: Find, analyze, and synthesize existing research.
Always cite sources and note confidence levels.
${memory.getContextSummary()}`,
    tools: {
      searchPapers: tool({
        description: 'Search academic papers',
        inputSchema: z.object({ query: z.string(), limit: z.number().optional() }),
        execute: async ({ query, limit }) => {
          // Simulated - replace with real API
          return { papers: [`Paper about ${query}`, `Study on ${query}`], count: limit || 10 };
        },
      }),
      analyzePaper: tool({
        description: 'Deep analysis of a paper',
        inputSchema: z.object({ paperId: z.string() }),
        execute: async ({ paperId }) => ({ 
          summary: `Analysis of ${paperId}`,
          keyFindings: ['Finding 1', 'Finding 2'],
          methodology: 'Described methodology',
        }),
      }),
    },
    stopWhen: stepCountIs(10),
  });

  // Hypothesis Generator Specialist
  const hypothesisAgent = new ToolLoopAgent({
    model: openai('gpt-4o'),
    instructions: `You are a Hypothesis Generation Specialist.
Your job: Generate creative, testable hypotheses.
Consider multiple angles and unconventional approaches.
${memory.getContextSummary()}`,
    tools: {
      brainstormHypotheses: tool({
        description: 'Generate multiple hypotheses',
        inputSchema: z.object({ 
          context: z.string(),
          constraints: z.array(z.string()).optional(),
        }),
        execute: async ({ context }) => ({
          hypotheses: [
            { statement: `Hypothesis A about ${context}`, novelty: 0.8 },
            { statement: `Hypothesis B about ${context}`, novelty: 0.6 },
            { statement: `Counter-hypothesis about ${context}`, novelty: 0.9 },
          ],
        }),
      }),
    },
    stopWhen: stepCountIs(5),
  });

  // Data Analysis Specialist
  const analysisAgent = new ToolLoopAgent({
    model: openai('gpt-4o'),
    instructions: `You are a Data Analysis Specialist.
Your job: Analyze data, find patterns, validate hypotheses.
Be rigorous and quantitative. Report confidence intervals.
${memory.getContextSummary()}`,
    tools: {
      analyzeData: tool({
        description: 'Statistical analysis',
        inputSchema: z.object({ data: z.string(), method: z.string() }),
        execute: async ({ data, method }) => ({
          result: `Analysis using ${method}`,
          pValue: 0.03,
          effectSize: 0.45,
          confidence: 0.95,
        }),
      }),
      validateHypothesis: tool({
        description: 'Test a hypothesis against data',
        inputSchema: z.object({ hypothesis: z.string(), evidence: z.array(z.string()) }),
        execute: async ({ hypothesis, evidence }) => ({
          supported: evidence.length > 2,
          confidence: Math.min(0.95, evidence.length * 0.2),
          reasoning: `Based on ${evidence.length} pieces of evidence`,
        }),
      }),
    },
    stopWhen: stepCountIs(8),
  });

  // Synthesis & Writing Specialist
  const synthesisAgent = new ToolLoopAgent({
    model: openai('gpt-4o'),
    instructions: `You are a Research Synthesis Specialist.
Your job: Synthesize findings into coherent narratives.
Write clear, well-structured research outputs.
${memory.getContextSummary()}`,
    tools: {
      synthesize: tool({
        description: 'Synthesize multiple findings',
        inputSchema: z.object({ findings: z.array(z.string()) }),
        execute: async ({ findings }) => ({
          synthesis: `Integrated view of ${findings.length} findings`,
          keyInsights: ['Insight 1', 'Insight 2'],
          gaps: ['Gap 1'],
        }),
      }),
    },
    stopWhen: stepCountIs(5),
  });

  // Critic & Reviewer Specialist
  const criticAgent = new ToolLoopAgent({
    model: openai('gpt-4o'),
    instructions: `You are a Research Critic Specialist.
Your job: Find weaknesses, suggest improvements, ensure rigor.
Be constructively critical. Challenge assumptions.
${memory.getContextSummary()}`,
    tools: {
      critique: tool({
        description: 'Critique research output',
        inputSchema: z.object({ content: z.string(), criteria: z.array(z.string()) }),
        execute: async ({ content, criteria }) => ({
          score: 7.5,
          strengths: ['Strength 1'],
          weaknesses: ['Weakness 1', 'Weakness 2'],
          suggestions: ['Suggestion 1'],
        }),
      }),
    },
    stopWhen: stepCountIs(5),
  });

  return {
    literature: literatureAgent,
    hypothesis: hypothesisAgent,
    analysis: analysisAgent,
    synthesis: synthesisAgent,
    critic: criticAgent,
  };
}

// ============================================
// TREE OF THOUGHTS + LATS (Hypothesis Exploration)
// ============================================

interface ThoughtNode {
  id: string;
  hypothesis: Hypothesis;
  evidence: string[];
  children: ThoughtNode[];
  value: number;  // LATS value function
  visits: number; // MCTS visits
  reflection: string | null;
}

async function exploreHypothesesWithLATS(
  hypotheses: Hypothesis[],
  memory: SERAMemory,
  maxIterations: number = 10
): Promise<{ bestPath: ThoughtNode[]; allNodes: ThoughtNode[] }> {
  // Initialize tree with hypotheses as root children
  const root: ThoughtNode = {
    id: 'root',
    hypothesis: { id: 'root', statement: 'Research Question', confidence: 1, evidence: [], status: 'exploring' },
    evidence: [],
    children: hypotheses.map((h, i) => ({
      id: `h${i}`,
      hypothesis: h,
      evidence: [],
      children: [],
      value: h.confidence,
      visits: 0,
      reflection: null,
    })),
    value: 0,
    visits: 0,
    reflection: null,
  };

  const allNodes: ThoughtNode[] = [root, ...root.children];

  for (let iter = 0; iter < maxIterations; iter++) {
    // 1. SELECT: UCB1 selection
    const selected = selectNode(root);
    
    // 2. EXPAND: Generate sub-hypotheses or evidence paths
    if (selected.children.length === 0 && selected.visits > 0) {
      const expansions = await expandHypothesis(selected, memory);
      selected.children = expansions;
      allNodes.push(...expansions);
    }

    // 3. SIMULATE: Evaluate the hypothesis path
    const simulationResult = await simulateHypothesis(selected, memory);
    
    // 4. EVALUATE: LLM-based value function
    selected.value = await evaluateNode(selected, simulationResult);
    
    // 5. BACKPROPAGATE
    backpropagate(selected, selected.value);
    
    // 6. REFLECT on low-value nodes
    if (selected.value < 0.3 && !selected.reflection) {
      selected.reflection = await reflectOnFailure(selected);
    }
  }

  // Find best path through tree
  const bestPath = findBestPath(root);
  return { bestPath, allNodes };
}

function selectNode(node: ThoughtNode, c: number = 1.41): ThoughtNode {
  if (node.children.length === 0) return node;
  
  const ucb = (child: ThoughtNode) => {
    if (child.visits === 0) return Infinity;
    return child.value / child.visits + c * Math.sqrt(Math.log(node.visits + 1) / child.visits);
  };
  
  const best = node.children.reduce((a, b) => ucb(a) > ucb(b) ? a : b);
  return selectNode(best, c);
}

async function expandHypothesis(node: ThoughtNode, memory: SERAMemory): Promise<ThoughtNode[]> {
  const { object } = await generateObject({
    model: openai('gpt-4o'),
    schema: z.object({
      subHypotheses: z.array(z.object({
        statement: z.string(),
        rationale: z.string(),
        testable: z.boolean(),
      })),
    }),
    prompt: `Given this hypothesis: "${node.hypothesis.statement}"
And this reflection on past attempts: ${node.reflection || 'None'}
Generate 3 sub-hypotheses or alternative angles to explore.`,
  });

  return subHypotheses.subHypotheses.map((sh, i) => ({
    id: `${node.id}-${i}`,
    hypothesis: {
      id: `${node.id}-${i}`,
      statement: sh.statement,
      confidence: 0.5,
      evidence: [],
      status: 'exploring' as const,
    },
    evidence: [],
    children: [],
    value: 0,
    visits: 0,
    reflection: null,
  }));
}

async function simulateHypothesis(node: ThoughtNode, memory: SERAMemory): Promise<string> {
  // Check if we have relevant past experience
  const relevantKnowledge = memory.getKnowledge(node.hypothesis.statement.split(' ')[0]);
  
  const { text } = await generateText({
    model: openai('gpt-4o'),
    prompt: `Simulate testing this hypothesis: "${node.hypothesis.statement}"
Relevant prior knowledge: ${relevantKnowledge.join('; ') || 'None'}
What evidence would we likely find? What's the probable outcome?`,
  });
  
  return text;
}

async function evaluateNode(node: ThoughtNode, simulation: string): Promise<number> {
  const { object } = await generateObject({
    model: openai('gpt-4o-mini'),
    schema: z.object({
      score: z.number().min(0).max(1),
      reasoning: z.string(),
    }),
    prompt: `Evaluate this hypothesis exploration:
Hypothesis: ${node.hypothesis.statement}
Simulation result: ${simulation}
Score from 0-1 based on promise and feasibility.`,
  });
  return object.score;
}

function backpropagate(node: ThoughtNode, value: number): void {
  let current: ThoughtNode | null = node;
  while (current) {
    current.visits++;
    current.value = (current.value * (current.visits - 1) + value) / current.visits;
    // Find parent (simplified - in production use parent pointers)
    current = null;
  }
}

async function reflectOnFailure(node: ThoughtNode): Promise<string> {
  const { text } = await generateText({
    model: openai('gpt-4o'),
    prompt: `This hypothesis path scored low: "${node.hypothesis.statement}"
Value: ${node.value}
What went wrong? What should be tried differently?`,
  });
  return text;
}

function findBestPath(root: ThoughtNode): ThoughtNode[] {
  const path: ThoughtNode[] = [];
  let current = root;
  
  while (current.children.length > 0) {
    const best = current.children.reduce((a, b) => 
      (a.value / Math.max(1, a.visits)) > (b.value / Math.max(1, b.visits)) ? a : b
    );
    path.push(best);
    current = best;
  }
  
  return path;
}

// ============================================
// SELF-IMPROVEMENT SYSTEM (Gödel + SICA patterns)
// ============================================

class SelfImprovementEngine {
  policy: AgentPolicy;
  policyHistory: AgentPolicy[] = [];
  performanceLog: { question: string; outcome: string; score: number }[] = [];

  constructor() {
    this.policy = {
      planningStrategy: 'Start with literature review, then hypothesize, then test',
      hypothesisExploration: 'Explore top 3 hypotheses in parallel using LATS',
      delegationRules: 'Assign based on task type: literature->literatureAgent, etc.',
      qualityThresholds: 'Require 0.7 confidence before accepting conclusions',
      learningRate: 0.1,
    };
  }

  logPerformance(question: string, outcome: string, score: number): void {
    this.performanceLog.push({ question, outcome, score });
  }

  async shouldImprove(): Promise<boolean> {
    const recentScores = this.performanceLog.slice(-10).map(p => p.score);
    const avgScore = recentScores.reduce((a, b) => a + b, 0) / recentScores.length;
    return avgScore < 0.7 || this.performanceLog.length % 5 === 0;
  }

  async improvePolicy(): Promise<void> {
    const recentFailures = this.performanceLog.filter(p => p.score < 0.5).slice(-5);
    
    const { object: analysis } = await generateObject({
      model: openai('gpt-4o'),
      schema: z.object({
        weaknesses: z.array(z.string()),
        suggestedChanges: z.array(z.object({
          aspect: z.enum(['planningStrategy', 'hypothesisExploration', 'delegationRules', 'qualityThresholds']),
          currentValue: z.string(),
          proposedValue: z.string(),
          rationale: z.string(),
        })),
      }),
      prompt: `Analyze these recent research failures and suggest policy improvements:
      
Failures:
${recentFailures.map(f => `- ${f.question}: ${f.outcome}`).join('\n')}

Current policy:
${JSON.stringify(this.policy, null, 2)}

What policy changes would improve performance?`,
    });

    // Validate and apply changes
    for (const change of analysis.suggestedChanges) {
      const { object: validation } = await generateObject({
        model: openai('gpt-4o'),
        schema: z.object({
          isSafe: z.boolean(),
          isCoherent: z.boolean(),
          concerns: z.array(z.string()),
        }),
        prompt: `Validate this policy change:
From: ${change.currentValue}
To: ${change.proposedValue}
Is this safe and coherent?`,
      });

      if (validation.isSafe && validation.isCoherent) {
        this.policyHistory.push({ ...this.policy });
        (this.policy as any)[change.aspect] = change.proposedValue;
        console.log(`Policy updated: ${change.aspect}`);
      }
    }
  }

  rollback(): void {
    if (this.policyHistory.length > 0) {
      this.policy = this.policyHistory.pop()!;
    }
  }
}

// ============================================
// CURRICULUM LEARNING SYSTEM
// ============================================

class CurriculumManager {
  currentDifficulty: number = 1;
  masteredDomains: Set<string> = new Set();

  assessDifficulty(question: ResearchQuestion): number {
    let difficulty = question.complexity;
    
    // Reduce if we've mastered the domain
    if (this.masteredDomains.has(question.domain)) {
      difficulty *= 0.8;
    }
    
    // Increase if requires unknown skills
    const unknownSkills = question.requiredSkills.filter(s => !this.masteredDomains.has(s));
    difficulty += unknownSkills.length * 0.5;
    
    return Math.min(10, Math.max(1, difficulty));
  }

  updateMastery(question: ResearchQuestion, success: boolean): void {
    if (success) {
      this.masteredDomains.add(question.domain);
      question.requiredSkills.forEach(s => this.masteredDomains.add(s));
      this.currentDifficulty = Math.min(10, this.currentDifficulty + 0.5);
    } else {
      this.currentDifficulty = Math.max(1, this.currentDifficulty - 0.3);
    }
  }

  isReadyFor(question: ResearchQuestion): boolean {
    const difficulty = this.assessDifficulty(question);
    return difficulty <= this.currentDifficulty + 2;  // Allow slight stretch
  }
}

// ============================================
// MAIN SERA ORCHESTRATOR
// ============================================

export class SERA {
  memory: SERAMemory;
  specialists: ReturnType<typeof createSpecialistAgents>;
  selfImprovement: SelfImprovementEngine;
  curriculum: CurriculumManager;

  constructor() {
    this.memory = new SERAMemory();
    this.specialists = createSpecialistAgents(this.memory);
    this.selfImprovement = new SelfImprovementEngine();
    this.curriculum = new CurriculumManager();
  }

  async research(questionText: string): Promise<{
    answer: string;
    confidence: number;
    process: string;
    skillsLearned: string[];
  }> {
    console.log('\n🔬 SERA: Starting research...\n');

    // 1. PARSE & ASSESS QUESTION
    const question = await this.parseQuestion(questionText);
    this.memory.currentContext.question = question;

    // Check curriculum readiness
    if (!this.curriculum.isReadyFor(question)) {
      console.log('⚠️ Question may be too difficult for current skill level');
    }

    // 2. RETRIEVE RELEVANT EXPERIENCE (Experience Replay)
    const similarExperiences = this.memory.findSimilarExperiences(question);
    console.log(`📚 Found ${similarExperiences.length} similar past experiences`);

    // 3. RETRIEVE APPLICABLE SKILLS (Skill Library)
    const applicableSkills = this.memory.findSkills(question.domain, questionText);
    console.log(`🛠️ Found ${applicableSkills.length} applicable skills`);

    // 4. PLAN RESEARCH (Plan-and-Execute)
    const plan = await this.createResearchPlan(question, similarExperiences, applicableSkills);
    this.memory.currentContext.plan = plan;
    console.log(`📋 Created plan with ${plan.phases.length} phases`);

    // 5. GENERATE HYPOTHESES (Multi-Agent + Tree of Thoughts)
    const hypotheses = await this.generateHypotheses(question, plan);
    this.memory.currentContext.activeHypotheses = hypotheses;
    console.log(`💡 Generated ${hypotheses.length} hypotheses`);

    // 6. EXPLORE HYPOTHESES (LATS)
    const { bestPath, allNodes } = await exploreHypothesesWithLATS(hypotheses, this.memory);
    console.log(`🌳 Explored ${allNodes.length} nodes, best path: ${bestPath.length} deep`);

    // 7. EXECUTE RESEARCH PHASES (Multi-Agent Orchestration)
    const findings = await this.executeResearchPlan(plan, bestPath);
    this.memory.currentContext.findings = findings;

    // 8. EVALUATE & ITERATE (Evaluator-Optimizer)
    const { finalAnswer, confidence } = await this.evaluateAndRefine(question, findings);

    // 9. REFLECT & LEARN (Reflexion)
    const reflections = await this.reflect(question, findings, confidence);

    // 10. EXTRACT SKILLS (Skill Library)
    const newSkills = await this.extractSkills(question, plan, findings);
    newSkills.forEach(s => this.memory.addSkill(s));

    // 11. STORE EXPERIENCE (Experience Replay)
    const experience: Experience = {
      id: `exp_${Date.now()}`,
      question,
      plan,
      trajectory: findings.map(f => ({ 
        agent: 'SERA', 
        action: 'research', 
        result: f,
        timestamp: new Date(),
      })),
      outcome: confidence > 0.7 ? 'success' : confidence > 0.4 ? 'partial' : 'failure',
      reflections,
      skillsLearned: newSkills.map(s => s.name),
    };
    this.memory.addExperience(experience);

    // 12. UPDATE CURRICULUM
    this.curriculum.updateMastery(question, confidence > 0.7);

    // 13. SELF-IMPROVE (Gödel Agent)
    this.selfImprovement.logPerformance(questionText, experience.outcome, confidence);
    if (await this.selfImprovement.shouldImprove()) {
      await this.selfImprovement.improvePolicy();
    }

    return {
      answer: finalAnswer,
      confidence,
      process: this.generateProcessSummary(plan, bestPath, findings),
      skillsLearned: newSkills.map(s => s.name),
    };
  }

  private async parseQuestion(text: string): Promise<ResearchQuestion> {
    const { object } = await generateObject({
      model: openai('gpt-4o'),
      schema: z.object({
        question: z.string(),
        complexity: z.number().min(1).max(10),
        domain: z.string(),
        requiredSkills: z.array(z.string()),
      }),
      prompt: `Parse this research question:
"${text}"

Assess complexity (1-10), identify domain, and list required research skills.`,
    });

    return { id: `q_${Date.now()}`, ...object };
  }

  private async createResearchPlan(
    question: ResearchQuestion,
    experiences: Experience[],
    skills: Skill[]
  ): Promise<ResearchPlan> {
    const experienceContext = experiences.length > 0
      ? `\nSuccessful approaches from similar research:\n${experiences.map(e => 
          e.plan.phases.map(p => p.name).join(' -> ')
        ).join('\n')}`
      : '';

    const skillContext = skills.length > 0
      ? `\nAvailable research skills:\n${skills.map(s => `- ${s.name}: ${s.description}`).join('\n')}`
      : '';

    const { object } = await generateObject({
      model: openai('gpt-4o'),
      schema: z.object({
        phases: z.array(z.object({
          name: z.string(),
          objectives: z.array(z.string()),
          assignedAgents: z.array(z.enum(['literature', 'hypothesis', 'analysis', 'synthesis', 'critic'])),
          dependencies: z.array(z.string()),
        })),
        hypotheses: z.array(z.object({
          statement: z.string(),
          confidence: z.number(),
        })),
        estimatedComplexity: z.number(),
      }),
      prompt: `Create a research plan for: "${question.question}"
Domain: ${question.domain}
Complexity: ${question.complexity}/10
${experienceContext}
${skillContext}

Current policy: ${this.selfImprovement.policy.planningStrategy}`,
    });

    return {
      ...object,
      hypotheses: object.hypotheses.map((h, i) => ({
        id: `h_${i}`,
        ...h,
        evidence: [],
        status: 'exploring' as const,
      })),
    };
  }

  private async generateHypotheses(question: ResearchQuestion, plan: ResearchPlan): Promise<Hypothesis[]> {
    // Use hypothesis specialist
    const result = await this.specialists.hypothesis.generate({
      prompt: `Generate hypotheses for: "${question.question}"
Initial hypotheses from plan: ${plan.hypotheses.map(h => h.statement).join('; ')}
Generate additional creative hypotheses.`,
    });

    // Parse and combine
    return [
      ...plan.hypotheses,
      // Add any new ones from the specialist
    ];
  }

  private async executeResearchPlan(plan: ResearchPlan, bestPath: ThoughtNode[]): Promise<string[]> {
    const findings: string[] = [];

    for (const phase of plan.phases) {
      console.log(`\n📍 Executing phase: ${phase.name}`);

      for (const agentName of phase.assignedAgents) {
        const agent = this.specialists[agentName as keyof typeof this.specialists];
        
        const result = await agent.generate({
          prompt: `Phase: ${phase.name}
Objectives: ${phase.objectives.join(', ')}
Best hypothesis path: ${bestPath.map(n => n.hypothesis.statement).join(' -> ')}
Previous findings: ${findings.slice(-3).join('; ')}

Execute your role in this phase.`,
        });

        findings.push(`[${agentName}] ${result.text}`);
      }
    }

    return findings;
  }

  private async evaluateAndRefine(
    question: ResearchQuestion,
    findings: string[]
  ): Promise<{ finalAnswer: string; confidence: number }> {
    let currentAnswer = '';
    let confidence = 0;
    let iterations = 0;
    const maxIterations = 3;

    while (confidence < 0.7 && iterations < maxIterations) {
      // Synthesize current answer
      const synthesisResult = await this.specialists.synthesis.generate({
        prompt: `Synthesize these findings into an answer for: "${question.question}"
Findings: ${findings.join('\n')}
${currentAnswer ? `Previous attempt (confidence ${confidence}): ${currentAnswer}` : ''}`,
      });

      currentAnswer = synthesisResult.text;

      // Critique
      const critiqueResult = await this.specialists.critic.generate({
        prompt: `Critique this research answer:
Question: ${question.question}
Answer: ${currentAnswer}
Rate confidence 0-1 and suggest improvements.`,
      });

      // Extract confidence from critique
      const { object } = await generateObject({
        model: openai('gpt-4o-mini'),
        schema: z.object({ confidence: z.number(), improvements: z.array(z.string()) }),
        prompt: `Extract confidence score and improvements from: ${critiqueResult.text}`,
      });

      confidence = object.confidence;

      if (confidence < 0.7 && object.improvements.length > 0) {
        findings.push(`[improvement-round-${iterations}] ${object.improvements.join('; ')}`);
      }

      iterations++;
    }

    return { finalAnswer: currentAnswer, confidence };
  }

  private async reflect(
    question: ResearchQuestion,
    findings: string[],
    confidence: number
  ): Promise<string[]> {
    const { object } = await generateObject({
      model: openai('gpt-4o'),
      schema: z.object({
        reflections: z.array(z.string()),
        lessonsLearned: z.array(z.string()),
        whatWorked: z.array(z.string()),
        whatDidnt: z.array(z.string()),
      }),
      prompt: `Reflect on this research process:
Question: ${question.question}
Final confidence: ${confidence}
Number of findings: ${findings.length}

What did we learn about conducting this type of research?`,
    });

    return object.reflections;
  }

  private async extractSkills(
    question: ResearchQuestion,
    plan: ResearchPlan,
    findings: string[]
  ): Promise<Skill[]> {
    const { object } = await generateObject({
      model: openai('gpt-4o'),
      schema: z.object({
        skills: z.array(z.object({
          name: z.string(),
          description: z.string(),
          steps: z.array(z.string()),
          applicableDomains: z.array(z.string()),
        })),
      }),
      prompt: `Extract reusable research skills from this process:
Domain: ${question.domain}
Plan phases: ${plan.phases.map(p => p.name).join(', ')}
Key findings: ${findings.slice(0, 5).join('; ')}

What generalizable research skills did we use or develop?`,
    });

    return object.skills.map(s => ({ ...s, successRate: 1, usageCount: 1 }));
  }

  private generateProcessSummary(
    plan: ResearchPlan,
    bestPath: ThoughtNode[],
    findings: string[]
  ): string {
    return `
=== SERA Research Process Summary ===

Plan: ${plan.phases.map(p => p.name).join(' → ')}

Hypothesis Exploration:
${bestPath.map((n, i) => `  ${i + 1}. ${n.hypothesis.statement} (value: ${n.value.toFixed(2)})`).join('\n')}

Key Findings: ${findings.length} total
${findings.slice(0, 5).map(f => `  - ${f.slice(0, 100)}...`).join('\n')}

Memory Status:
${this.memory.getContextSummary()}

Curriculum Level: ${this.curriculum.currentDifficulty.toFixed(1)}/10
Mastered Domains: ${[...this.curriculum.masteredDomains].join(', ')}
`;
  }
}

// ============================================
// USAGE
// ============================================

async function main() {
  const sera = new SERA();

  // First research question (simpler)
  console.log('\n' + '='.repeat(60));
  console.log('Research Question 1: Simple');
  console.log('='.repeat(60));
  
  const result1 = await sera.research(
    'What are the main factors affecting solar panel efficiency?'
  );
  console.log('\nAnswer:', result1.answer.slice(0, 500));
  console.log('Confidence:', result1.confidence);
  console.log('Skills Learned:', result1.skillsLearned);

  // Second research question (builds on first)
  console.log('\n' + '='.repeat(60));
  console.log('Research Question 2: Building on previous');
  console.log('='.repeat(60));

  const result2 = await sera.research(
    'How can we optimize solar panel placement in urban environments?'
  );
  console.log('\nAnswer:', result2.answer.slice(0, 500));
  console.log('Confidence:', result2.confidence);
  console.log('Skills Learned:', result2.skillsLearned);

  // Third research question (more complex, different domain)
  console.log('\n' + '='.repeat(60));
  console.log('Research Question 3: New domain, higher complexity');
  console.log('='.repeat(60));

  const result3 = await sera.research(
    'What is the relationship between gut microbiome diversity and mental health outcomes?'
  );
  console.log('\nAnswer:', result3.answer.slice(0, 500));
  console.log('Confidence:', result3.confidence);
  console.log('Skills Learned:', result3.skillsLearned);
}

// Export for use
export { SERA, SERAMemory, SelfImprovementEngine, CurriculumManager };

// Uncomment to run:
// main().catch(console.error);

// ┌─────────────────────────────────────────────────────────────────────────────┐
// │                              SERA MEGA-AGENT                                │
// ├─────────────────────────────────────────────────────────────────────────────┤
// │                                                                             │
// │  ┌─────────────┐    ┌──────────────────────────────────────────────────┐   │
// │  │  QUESTION   │───▶│  1. CURRICULUM CHECK                             │   │
// │  └─────────────┘    │     Is agent ready for this difficulty?          │   │
// │                     └──────────────────────────────────────────────────┘   │
// │                                        │                                    │
// │                                        ▼                                    │
// │  ┌──────────────────────────────────────────────────────────────────────┐  │
// │  │  2. MEMORY RETRIEVAL                                                  │  │
// │  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                   │  │
// │  │  │  Episodic   │  │  Semantic   │  │ Procedural  │                   │  │
// │  │  │ (Past Exp)  │  │ (Facts)     │  │ (Skills)    │                   │  │
// │  │  └─────────────┘  └─────────────┘  └─────────────┘                   │  │
// │  └──────────────────────────────────────────────────────────────────────┘  │
// │                                        │                                    │
// │                                        ▼                                    │
// │  ┌──────────────────────────────────────────────────────────────────────┐  │
// │  │  3. PLAN-AND-EXECUTE                                                  │  │
// │  │     Create phased research plan based on past successes               │  │
// │  └──────────────────────────────────────────────────────────────────────┘  │
// │                                        │                                    │
// │                                        ▼                                    │
// │  ┌──────────────────────────────────────────────────────────────────────┐  │
// │  │  4. HYPOTHESIS EXPLORATION (Tree-of-Thoughts + LATS)                  │  │
// │  │                                                                        │  │
// │  │                        [Root Question]                                 │  │
// │  │                       /      |       \                                 │  │
// │  │                   [H1]     [H2]     [H3]     ◀── UCB1 Selection        │  │
// │  │                   /  \       |                                         │  │
// │  │               [H1a] [H1b]  [H2a]             ◀── Expansion             │  │
// │  │                 │                                                      │  │
// │  │              [Simulate & Evaluate]          ◀── Value Function         │  │
// │  │                 │                                                      │  │
// │  │              [Backpropagate]                                           │  │
// │  │                 │                                                      │  │
// │  │              [Reflect on failures]          ◀── Reflexion              │  │
// │  └──────────────────────────────────────────────────────────────────────┘  │
// │                                        │                                    │
// │                                        ▼                                    │
// │  ┌──────────────────────────────────────────────────────────────────────┐  │
// │  │  5. MULTI-AGENT EXECUTION                                             │  │
// │  │                                                                        │  │
// │  │    ┌─────────┐   ┌─────────┐   ┌─────────┐   ┌─────────┐   ┌───────┐ │  │
// │  │    │Literature│──▶│Hypothesis│──▶│Analysis │──▶│Synthesis│──▶│Critic │ │  │
// │  │    │  Agent  │   │  Agent  │   │  Agent  │   │  Agent  │   │ Agent │ │  │
// │  │    └─────────┘   └─────────┘   └─────────┘   └─────────┘   └───────┘ │  │
// │  │         │              │             │             │            │     │  │
// │  │         └──────────────┴─────────────┴─────────────┴────────────┘     │  │
// │  │                                   │                                    │  │
// │  │                            [Findings Pool]                             │  │
// │  └──────────────────────────────────────────────────────────────────────┘  │
// │                                        │                                    │
// │                                        ▼                                    │
// │  ┌──────────────────────────────────────────────────────────────────────┐  │
// │  │  6. EVALUATOR-OPTIMIZER LOOP                                          │  │
// │  │                                                                        │  │
// │  │     ┌──────────┐      ┌──────────┐      ┌──────────┐                  │  │
// │  │     │Synthesize│─────▶│ Critique │─────▶│Confidence│                  │  │
// │  │     │  Answer  │      │  Answer  │      │  < 0.7?  │                  │  │
// │  │     └──────────┘      └──────────┘      └────┬─────┘                  │  │
// │  │           ▲                                  │                         │  │
// │  │           └────────── YES ───────────────────┘                         │  │
// │  │                       (iterate up to 3x)                               │  │
// │  └──────────────────────────────────────────────────────────────────────┘  │
// │                                        │                                    │
// │                                        ▼                                    │
// │  ┌──────────────────────────────────────────────────────────────────────┐  │
// │  │  7. POST-RESEARCH LEARNING                                            │  │
// │  │                                                                        │  │
// │  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐       │  │
// │  │  │    Reflect      │  │  Extract Skills │  │ Store Experience│       │  │
// │  │  │  (Reflexion)    │  │    (Voyager)    │  │ (SiriuS Replay) │       │  │
// │  │  └─────────────────┘  └─────────────────┘  └─────────────────┘       │  │
// │  │                                                                        │  │
// │  │  ┌─────────────────┐  ┌─────────────────┐                            │  │
// │  │  │Update Curriculum│  │  Self-Improve   │                            │  │
// │  │  │    Mastery      │  │  Policy (SICA)  │                            │  │
// │  │  └─────────────────┘  └─────────────────┘                            │  │
// │  └──────────────────────────────────────────────────────────────────────┘  │
// │                                        │                                    │
// │                                        ▼                                    │
// │                              ┌─────────────────┐                           │
// │                              │  FINAL ANSWER   │                           │
// │                              │  + Confidence   │                           │
// │                              │  + Skills Learned│                          │
// │                              └─────────────────┘                           │
// └─────────────────────────────────────────────────────────────────────────────┘