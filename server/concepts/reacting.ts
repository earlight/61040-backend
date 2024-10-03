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

  async delete(_id: ObjectId) {
    await this.reactions.deleteOne({ _id });
    return { msg: "Reaction deleted successfully!" };
  }

  async assertAuthorIsUser(_id: ObjectId, user: ObjectId) {
    const reaction = await this.reactions.readOne({ _id });
    if (!reaction) {
      throw new NotFoundError(`Reaction ${_id} does not exist!`);
    }
    if (reaction.author.toString() !== user.toString()) {
      throw new ReactionAuthorNotMatchError(user, _id);
    }
  }
}

export class ReactionAuthorNotMatchError extends NotAllowedError {
  constructor(
    public readonly author: ObjectId,
    public readonly _id: ObjectId,
  ) {
    super("{0} is not the author of reaction {1}!", author, _id);
  }
}
