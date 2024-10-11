import { ObjectId } from "mongodb";
import DocCollection, { BaseDoc } from "../framework/doc";
import { NotAllowedError, NotFoundError } from "./errors";

export interface FollowDoc extends BaseDoc {
  follower: ObjectId;
  followee: ObjectId;
}

/**
 * concept: Following [User]
 */
export default class FollowingConcept {
  public readonly follows: DocCollection<FollowDoc>;

  /**
   * Make an instance of Following.
   */
  constructor(collectionName: string) {
    this.follows = new DocCollection<FollowDoc>(collectionName);
  }

  async getFollowers(user: ObjectId) {
    return await this.follows.readMany({ followee: user });
  }

  async getFollowing(user: ObjectId) {
    return await this.follows.readMany({ follower: user });
  }

  async follow(follower: ObjectId, followee: ObjectId) {
    await this.canFollow(follower, followee);
    await this.follows.createOne({ follower, followee });
    return { msg: "Followed!" };
  }

  async unfollow(follower: ObjectId, followee: ObjectId) {
    await this.canUnfollow(follower, followee);
    await this.follows.deleteOne({ follower, followee });
    return { msg: "Unfollowed!" };
  }

  private async canFollow(follower: ObjectId, followee: ObjectId) {
    if (follower.equals(followee)) {
      throw new SelfFollowError(follower);
    }
    if (await this.follows.readOne({ follower, followee })) {
      throw new AlreadyFollowingError(follower, followee);
    }
  }

  private async canUnfollow(follower: ObjectId, followee: ObjectId) {
    if (follower.equals(followee)) {
      throw new SelfUnfollowError(follower);
    }
    if (!(await this.follows.readOne({ follower, followee }))) {
      throw new NotFollowingError(follower, followee);
    }
  }
}

export class AlreadyFollowingError extends NotAllowedError {
  constructor(
    public follower: ObjectId,
    public followee: ObjectId,
  ) {
    super("{0} is already following {1}!", follower, followee);
  }
}

export class NotFollowingError extends NotFoundError {
  constructor(
    public follower: ObjectId,
    public followee: ObjectId,
  ) {
    super("{0} is already not following {1}!", follower, followee);
  }
}

export class SelfFollowError extends NotAllowedError {
  constructor(public user: ObjectId) {
    super("Cannot follow yourself!", user);
  }
}

export class SelfUnfollowError extends NotAllowedError {
  constructor(public user: ObjectId) {
    super("Cannot unfollow yourself!", user);
  }
}
