import { ObjectId } from "mongodb";

import DocCollection, { BaseDoc } from "../framework/doc";
import { NotAllowedError, NotFoundError } from "./errors";

export interface ScoreDoc extends BaseDoc {
  item: ObjectId;
  score: number;
}

const MIN_SCORE = 0;
const MAX_SCORE = 100;
const DEFAULT_SCORE = 50;

/**
 * concept: Scoring [Item]
 */
export default class ScoringConcept {
  public readonly scores: DocCollection<ScoreDoc>;

  /**
   * Make an instance of Scoring.
   */
  constructor(collectionName: string) {
    this.scores = new DocCollection<ScoreDoc>(collectionName);
  }

  async create(item: ObjectId) {
    const score = DEFAULT_SCORE;
    if (await this.scores.readOne({ item })) {
      throw new ScoreItemAlreadyExistsError(item);
    }
    if (score < MIN_SCORE || score > MAX_SCORE || score == null) {
      throw new ScoreInvalidError(item, score, MIN_SCORE, MAX_SCORE);
    }
    const _id = await this.scores.createOne({ item, score });
    return { msg: "Score successfully created!", score: await this.scores.readOne({ _id }) };
  }

  async getScores() {
    // Returns all scores! You might want to page for better client performance
    return await this.scores.readMany({}, { sort: { _id: -1 } });
  }

  async getByItem(item: ObjectId) {
    const score = await this.scores.readOne({ item });
    if (!score) {
      throw new ScoreItemNotFoundError(item);
    }
    return score;
  }

  async update(item: ObjectId, score: number) {
    const existingScore = await this.scores.readOne({ item });
    if (!existingScore) {
      throw new ScoreItemNotFoundError(item);
    }
    if (score < MIN_SCORE || score > MAX_SCORE || score == null || isNaN(score)) {
      throw new ScoreInvalidError(item, score, MIN_SCORE, MAX_SCORE);
    }
    await this.scores.partialUpdateOne({ item }, { score });
    return { msg: "Score successfully updated!" };
  }
}

export class ScoreInvalidError extends NotAllowedError {
  constructor(
    public readonly item: ObjectId,
    public readonly score: number,
    public readonly min: number,
    public readonly max: number,
  ) {
    super(`Score ${score} for item ${item} is not a valid number in the range [${min}, ${max}]!`);
  }
}

export class ScoreItemAlreadyExistsError extends NotAllowedError {
  constructor(public readonly item: ObjectId) {
    super(`Score for item ${item} already exists!`);
  }
}

export class ScoreItemNotFoundError extends NotFoundError {
  constructor(public readonly item: ObjectId) {
    super(`Item ${item} does not have a score!`);
  }
}
