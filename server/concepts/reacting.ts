import { ObjectId } from "mongodb";

import DocCollection, { BaseDoc } from "../framework/doc";
import { NotAllowedError, NotFoundError } from "./errors";

export interface ReactionDoc extends BaseDoc {
  author: ObjectId;
  type: string;
  item: ObjectId;
}

/**
 * concept: Reacting [Author, Item]
 */
export default class ReactingConcept {
  public readonly reactions: DocCollection<ReactionDoc>;

  /**
   * Make an instance of Reacting.
   */
  constructor(collectionName: string) {
    this.reactions = new DocCollection<ReactionDoc>(collectionName);
  }

  async create(author: ObjectId, type: string, item: ObjectId) {
    const _id = await this.reactions.createOne({ author, type, item });
    return { msg: "Reaction successfully created!", reaction: await this.reactions.readOne({ _id }) };
  }

  async getReactions() {
    // Returns all reactions! You might want to page for better client performance
    return await this.reactions.readMany({}, { sort: { _id: -1 } });
  }

  async getByAuthor(author: ObjectId) {
    return await this.reactions.readMany({ author });
  }

  async getByItem(item: ObjectId) {
    return await this.reactions.readMany({ item });
  }

  async update(author: ObjectId, type: string, item: ObjectId) {
    await this.reactions.partialUpdateOne({ author, item }, { type });
    return { msg: "Reaction successfully updated!" };
  }

  async delete(author: ObjectId, item: ObjectId) {
    await this.reactions.deleteOne({ author, item });
    return { msg: "Reaction deleted successfully!" };
  }

  async assertReactionExists(author: ObjectId, item: ObjectId) {
    if (!(await this.reactions.readOne({ author, item }))) {
      throw new ReactionNotFoundError(author, item);
    }
  }

  async assertNotAlreadyReacted(author: ObjectId, item: ObjectId) {
    const reaction = await this.reactions.readOne({ author, item });
    if (reaction) {
      throw new AlreadyReactedError(author, item);
    }
  }
}

export class ReactionNotFoundError extends NotFoundError {
  constructor(
    public readonly author: ObjectId,
    public readonly item: ObjectId,
  ) {
    super("Reaction not found for {0} on item {1}!", author, item);
  }
}

export class AlreadyReactedError extends NotAllowedError {
  constructor(
    public readonly author: ObjectId,
    public readonly item: ObjectId,
  ) {
    super("{0} has already reacted to item {1}!", author, item);
  }
}
