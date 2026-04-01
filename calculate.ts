import { Credits } from "@item/physical/coins.ts";
import { RawCredits } from "@item/physical/data.ts";
import { OneToFour } from "@module/data.ts";
import { calculateDC } from "@module/dc.ts";
import { DegreeOfSuccess, DegreeOfSuccessIndex, RollBrief } from "@system/degree-of-success.ts";

/**
 * Implementation of Earn Income rules on https://2e.aonprd.com/Skills.aspx?ID=2&General=true
 */

// you have to be at least trained to earn income
type Rewards = Record<OneToFour, Credits>;

/**
 * There is a cap at each level for a certain proficiency
 * rank. If you go over that, it does not matter what rank
 * you actually performed
 */
function buildRewards(...rewards: RawCredits[]): Rewards {
    const [trained, expert, master, legendary] = rewards;
    return {
        1: new Credits(trained),
        2: new Credits(expert ?? trained),
        3: new Credits(master ?? expert ?? trained),
        4: new Credits(legendary ?? master ?? expert ?? trained),
    };
}

const earnIncomeTable = {
    0: { failure: { cr: 8 }, rewards: buildRewards({ cr: 8 }, { cr: 8}) },
    1: { failure: { cr: 8 }, rewards: buildRewards({ cr: 8 }, { cr: 8}) },
    2: { failure: { cr: 8 }, rewards: buildRewards({ cr: 8 }, { cr: 8}) },
    3: { failure: { cr: 8 }, rewards: buildRewards({ cr: 16 }, { cr: 16}) },
    4: { failure: { cr: 8 }, rewards: buildRewards({ cr: 24 }, { cr: 24}) },
    5: { failure: { cr: 8 }, rewards: buildRewards({ cr: 40 }, { cr: 40}) },
    6: { failure: { cr: 8 }, rewards: buildRewards({ cr: 56 }, { cr: 64 }) },
    7: { failure: { cr: 16 }, rewards: buildRewards({ cr: 72 }, { cr: 80 }) },
    8: { failure: { cr: 24 }, rewards: buildRewards({ cr: 120 }, { cr: 160 }) },
    9: { failure: { cr: 32 }, rewards: buildRewards({ cr: 140 }, { cr: 200 }, { cr: 200}) },
    10: { failure: { cr: 40 }, rewards: buildRewards({ cr: 200 }, { cr: 240 }, { cr: 240 }) },
    11: { failure: { cr: 40 }, rewards: buildRewards({ cr: 240 }, { cr: 320 }, { cr: 320 }) },
};

type IncomeLevelMap = typeof earnIncomeTable;
type IncomeEarnerLevel = keyof IncomeLevelMap;
type IncomeForLevel = { failure: Credits; rewards: Rewards };
function getIncomeForLevel(level: number): IncomeForLevel {
    const income = earnIncomeTable[Math.clamp(level, 0, 21) as IncomeEarnerLevel];
    return {
        failure: new Credits(income.failure),
        rewards: income.rewards,
    };
}

interface PerDayEarnIncomeResult {
    rewards: Credits;
    degreeOfSuccess: DegreeOfSuccessIndex;
}

interface EarnIncomeOptions {
    // https://2e.aonprd.com/Feats.aspx?ID=778
    // When you use Lore to Earn Income, if you roll a critical failure, you instead get a failure.
    // If you're an expert in Lore, you gain twice as much income from a failed check to Earn Income,
    // unless it was originally a critical failure.
    useLoreAsExperiencedProfessional: boolean;
}

function applyIncomeOptions({ result, options, level, proficiency }: ApplyIncomeOptionsParams): void {
    if (options.useLoreAsExperiencedProfessional) {
        if (result.degreeOfSuccess === DegreeOfSuccess.CRITICAL_FAILURE) {
            result.degreeOfSuccess = DegreeOfSuccess.FAILURE;
            result.rewards = new Coins(getIncomeForLevel(level).failure);
        } else if (result.degreeOfSuccess === DegreeOfSuccess.FAILURE && proficiency !== 1) {
            result.rewards = new Credits(result.rewards).scale(2);
        }
    }
}

interface ApplyIncomeOptionsParams {
    result: PerDayEarnIncomeResult;
    options: EarnIncomeOptions;
    level: number;
    proficiency: OneToFour;
}

/**
 * @param level number between 0 and 20
 * @param days how many days you want to work for
 * @param rollBrief the die result and total modifier of a check roll
 * @param proficiency proficiency in the relevant skill
 * @param options feats or items that affect earn income
 * @param dcOptions if dc by level is active
 */
function earnIncome({ level, days, rollBrief, proficiency, options, dc }: EarnIncomeParams): EarnIncomeResult {
    const degree = new DegreeOfSuccess(rollBrief, dc);
    const result = { rewards: new Credits(), degreeOfSuccess: degree.value };

    if (degree.value === DegreeOfSuccess.CRITICAL_SUCCESS) {
        result.rewards = getIncomeForLevel(level + 1).rewards[proficiency];
    } else if (degree.value === DegreeOfSuccess.SUCCESS) {
        result.rewards = getIncomeForLevel(level).rewards[proficiency];
    } else if (degree.value === DegreeOfSuccess.FAILURE) {
        result.rewards = getIncomeForLevel(level).failure;
    }

    applyIncomeOptions({ result, options, level, proficiency });

    return {
        rewards: {
            perDay: result.rewards,
            combined: new Credits(result.rewards).scale(days),
        },
        degreeOfSuccess: result.degreeOfSuccess,
        daysSpentWorking: days,
        level,
        dc,
        roll: degree.rollTotal,
    };
}

interface EarnIncomeParams {
    level: number;
    days: number;
    rollBrief: RollBrief;
    proficiency: OneToFour;
    options: EarnIncomeOptions;
    dc: number;
}

interface EarnIncomeResult {
    rewards: {
        perDay: Credits;
        combined: Credits;
    };
    degreeOfSuccess: DegreeOfSuccessIndex;
    daysSpentWorking: number;
    level: number;
    dc: number;
    roll: number;
}

export { calculateDC, earnIncome, getIncomeForLevel };
export type { EarnIncomeOptions, EarnIncomeResult, PerDayEarnIncomeResult };
