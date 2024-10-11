import { ObjectId } from "mongodb";

import { Router, getExpressRouter } from "./framework/router";

import { Authing, Commenting, Following, Posting, Reacting, Scoring, Sessioning } from "./app";
import { PostOptions } from "./concepts/posting";
import { SessionDoc } from "./concepts/sessioning";
import Responses from "./responses";

import { z } from "zod";

/**
 * Web server routes for the app. Implements synchronizations between concepts.
 */
class Routes {
  // Synchronize the concepts from `app.ts`.

  /**
   * Get the session user.
   *
   * @param session - The session of the user.
   * @returns UserDoc - The user.
   */
  @Router.get("/session")
  async getSessionUser(session: SessionDoc) {
    const user = Sessioning.getUser(session);
    return await Authing.getUserById(user);
  }

  /**
   * Get all users.
   *
   * @returns UserDoc[] - A list of users.
   */
  @Router.get("/users")
  async getUsers() {
    return await Authing.getUsers();
  }

  /**
   * Get a user by username.
   *
   * @param username - The username of the user.
   * @returns UserDoc - The user.
   */
  @Router.get("/users/:username")
  @Router.validate(z.object({ username: z.string().min(1) }))
  async getUser(username: string) {
    return await Authing.getUserByUsername(username);
  }

  /**
   * Creates a user, as well as a default initial score for the user.
   *
   * @param session - The session of the user creating the user.
   * @param username - The username of the user.
   * @param password - The password of the user.
   * @returns { msg: string, user: UserDoc } - A message and the created user.
   */
  @Router.post("/users")
  async createUser(session: SessionDoc, username: string, password: string) {
    Sessioning.isLoggedOut(session);
    const created = await Authing.create(username, password);
    if (created.user) {
      Scoring.create(created.user._id);
    }
    return created;
  }

  /**
   * Updates the password of a user.
   *
   * @param session - The session of the user updating the password.
   * @param currentPassword - The current password.
   * @param newPassword - The new password.
   * @returns { msg: string } - A message indicating success.
   */
  @Router.patch("/users/password")
  async updatePassword(session: SessionDoc, currentPassword: string, newPassword: string) {
    const user = Sessioning.getUser(session);
    return Authing.updatePassword(user, currentPassword, newPassword);
  }

  @Router.delete("/users")
  async deleteUser(session: SessionDoc) {
    const user = Sessioning.getUser(session);
    Sessioning.end(session);
    return await Authing.delete(user);
  }

  /**
   * Logs in a user.
   *
   * @param session - The session of the user logging in.
   * @param username - The username of the user.
   * @param password - The password of the user.
   * @returns { msg: string } - A message indicating success.
   */
  @Router.post("/login")
  async logIn(session: SessionDoc, username: string, password: string) {
    const u = await Authing.authenticate(username, password);
    Sessioning.start(session, u._id);
    return { msg: "Logged in!" };
  }

  /**
   * Logs out a user.
   *
   * @param session - The session of the user logging out.
   * @returns { msg: string } - A message indicating success.
   */
  @Router.post("/logout")
  async logOut(session: SessionDoc) {
    Sessioning.end(session);
    return { msg: "Logged out!" };
  }

  /**
   * Returns posts by a specific author, or all posts if no author is specified.
   *
   * @param author - The author's username (optional).
   * @returns PostDoc[] - A list of posts.
   */
  @Router.get("/posts")
  @Router.validate(z.object({ author: z.string().optional() }))
  async getPosts(author?: string) {
    let posts;
    if (author) {
      const id = (await Authing.getUserByUsername(author))._id;
      posts = await Posting.getByAuthor(id);
    } else {
      posts = await Posting.getPosts();
    }
    return Responses.posts(posts);
  }

  /**
   * Creates a post, as well as a default initial score for the post.
   *
   * @param session - The session of the user creating the post.
   * @param content - The content of the post.
   * @param options - The options of the post (optional).
   * @returns { msg: string, post: PostDoc } - A message and the created post.
   */
  @Router.post("/posts")
  async createPost(session: SessionDoc, content: string, options?: PostOptions) {
    const user = Sessioning.getUser(session);
    const created = await Posting.create(user, content, options);
    if (created.post) {
      Scoring.create(created.post._id);
    }
    return { msg: created.msg, post: await Responses.post(created.post) };
  }

  /**
   * Deletes a post.
   *
   * @param session - The session of the user deleting the post.
   * @param id - The ID of the post to update.
   * @returns { msg: string } - A message indicating success.
   */
  @Router.delete("/posts/:id")
  async deletePost(session: SessionDoc, id: string) {
    const user = Sessioning.getUser(session);
    const oid = new ObjectId(id);
    await Posting.assertAuthorIsUser(oid, user);
    return Posting.delete(oid);
  }

  /**
   * Returns comments by a specific author, or all comments if no author is specified.
   *
   * @param author - The author's username (optional).
   * @returns CommentDoc[] - A list of comments.
   */
  @Router.get("/comments")
  @Router.validate(z.object({ author: z.string().optional() }))
  async getComments(author?: string) {
    let comments;
    if (author) {
      const id = (await Authing.getUserByUsername(author))._id;
      comments = await Commenting.getByAuthor(id);
    } else {
      comments = await Commenting.getComments();
    }
    return Responses.comments(comments);
  }

  /**
   * Returns comments by a specific parent.
   *
   * @param parent - The parent's ID.
   * @returns CommentDoc[] - A list of comments.
   */
  @Router.get("/comments/parent")
  async getCommentsByParent(parent: string) {
    const parentOid = new ObjectId(parent);
    return Responses.comments(await Commenting.getByParent(parentOid));
  }

  /**
   * Creates a comment under a post or another comment, as well as a default initial score for the comment.
   *
   * @param session - The session of the user creating the comment.
   * @param content - The content of the comment.
   * @param parent - The parent of the comment.
   * @returns { msg: string, comment: CommentDoc } - A message and the created comment.
   */
  @Router.post("/comments")
  async createComment(session: SessionDoc, content: string, parent: string) {
    const user = Sessioning.getUser(session);
    const parentOid = new ObjectId(parent);
    try {
      await Posting.assertPostExists(parentOid);
    } catch {
      await Commenting.assertCommentExists(parentOid);
    }
    const created = await Commenting.create(user, content, parentOid);
    if (created.comment) {
      Scoring.create(created.comment._id);
    }
    return { msg: created.msg, comment: await Responses.comment(created.comment) };
  }

  /**
   * Deletes a comment.
   *
   * @param session - The session of the user deleting the comment.
   * @param id - The ID of the comment to delete.
   * @returns { msg: string } - A message indicating success.
   */
  @Router.delete("/comments/:id")
  async deleteComment(session: SessionDoc, id: string) {
    const user = Sessioning.getUser(session);
    const oid = new ObjectId(id);
    await Commenting.assertAuthorIsUser(oid, user);
    return Commenting.delete(oid);
  }

  /**
   * Returns reactions by a specific author, or all reactions if no author is specified.
   *
   * @param author - The author's username (optional).
   * @returns ReactionDoc[] - A list of reactions.
   */
  @Router.get("/reactions")
  @Router.validate(z.object({ author: z.string().optional() }))
  async getReactions(author?: string) {
    let reactions;
    if (author) {
      const id = (await Authing.getUserByUsername(author))._id;
      reactions = await Reacting.getByAuthor(id);
    } else {
      reactions = await Reacting.getReactions();
    }
    return Responses.reactions(reactions);
  }

  /**
   * Returns reactions to a specific post or comment.
   *
   * @param item - The ObjectId of the post or comment.
   * @returns ReactionDoc[] - A list of reactions.
   */
  @Router.get("/reactions/item")
  async getReactionsByItem(item: string) {
    const itemOid = new ObjectId(item);
    return Responses.reactions(await Reacting.getByItem(itemOid));
  }

  /**
   * Creates a reaction to a post or comment.
   *
   * @param session - The session of the user creating the reaction.
   * @param type - The type of reaction.
   * @param item - The ObjectId of the post or comment that the reaction is for.
   * @returns { msg: string, reaction: ReactionDoc } - A message and the created reaction.
   */
  @Router.post("/reactions")
  async createReaction(session: SessionDoc, type: string, item: string) {
    const user = Sessioning.getUser(session);
    const itemOid = new ObjectId(item);
    try {
      await Posting.assertPostExists(itemOid);
    } catch {
      await Commenting.assertCommentExists(itemOid);
    }
    await Reacting.assertNotAlreadyReacted(user, itemOid);
    const created = await Reacting.create(user, type, itemOid);
    return { msg: created.msg, reaction: await Responses.reaction(created.reaction) };
  }

  /**
   * Updates a reaction to a post or comment.
   *
   * @param session - The session of the user updating the reaction.
   * @param type - The update type of reaction.
   * @param item - The ObjectId of the post or comment that the reaction is for.
   * @returns { msg: string } - A message indicating success.
   */
  @Router.patch("/reactions")
  async updateReaction(session: SessionDoc, type: string, item: string) {
    const user = Sessioning.getUser(session);
    const itemOid = new ObjectId(item);
    await Reacting.assertReactionExists(user, itemOid);
    await Reacting.update(user, type, itemOid);
    return { msg: "Reaction successfully updated!" };
  }

  /**
   * Deletes a reaction to a post or comment.
   *
   * @param session - The session of the user deleting the reaction.
   * @param item - The ObjectId of the post or comment that the reaction is for.
   * @returns { msg: string } - A message indicating success.
   */
  @Router.delete("/reactions")
  async deleteReaction(session: SessionDoc, item: string) {
    const user = Sessioning.getUser(session);
    const itemOid = new ObjectId(item);
    await Reacting.assertReactionExists(user, itemOid);
    await Reacting.delete(user, itemOid);
    return { msg: "Reaction deleted successfully!" };
  }

  /**
   * Get a user's followers.
   *
   * @param username - The username of the user.
   * @returns FollowDoc[] - A list of follows where the user is the followee.
   */
  @Router.get("/followers")
  async getFollowers(username: string) {
    const userOid = (await Authing.getUserByUsername(username))._id;
    return await Responses.follows(await Following.getFollowers(userOid));
  }

  /**
   * Get who a user is following.
   *
   * @param username - The username of the user.
   * @returns FollowDoc[] - A list of follows where the user is the follower
   */
  @Router.get("/following")
  async getFollowing(username: string) {
    const userOid = (await Authing.getUserByUsername(username))._id;
    return await Responses.follows(await Following.getFollowing(userOid));
  }

  /**
   * Follow a user by username.
   *
   * @param session - The session of the user following.
   * @param username - The username of the user to follow.
   * @returns { msg: string } - A message indicating success.
   */
  @Router.post("/follow")
  async follow(session: SessionDoc, username: string) {
    const user = Sessioning.getUser(session);
    const followeeOid = (await Authing.getUserByUsername(username))._id;
    return await Following.follow(user, followeeOid);
  }

  /**
   * Unfollow a user by username.
   *
   * @param session - The session of the user unfollowing.
   * @param username - The username of the user to unfollow.
   * @returns { msg: string } - A message indicating success.
   */
  @Router.delete("/follow")
  async unfollow(session: SessionDoc, username: string) {
    const user = Sessioning.getUser(session);
    const followeeOid = (await Authing.getUserByUsername(username))._id;
    return await Following.unfollow(user, followeeOid);
  }

  /**
   * Get the score of an item by ObjectId, or all scores if no item is specified.
   *
   * @param item - The ObjectId of the item (optional).
   * @returns ScoreDoc[] - A list of scores.
   */
  @Router.get("/score")
  @Router.validate(z.object({ item: z.string().optional() }))
  async getScoreByItem(item?: string) {
    if (item) {
      const itemOid = new ObjectId(item);
      return await Scoring.getByItem(itemOid);
    } else {
      return await Scoring.getScores();
    }
  }

  /**
   * Update the score of an item by the item's ObjectId.
   *
   * @param item - The ObjectId of the item.
   * @param score - The new score.
   * @returns { msg: string } - A message indicating success.
   */
  @Router.patch("/score")
  async updateScoreByItem(item: string, score: number) {
    const itemOid = new ObjectId(item);
    return await Scoring.update(itemOid, score);
  }
}

/** The web app. */
export const app = new Routes();

/** The Express router. */
export const appRouter = getExpressRouter(app);
