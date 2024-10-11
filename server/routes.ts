import { ObjectId } from "mongodb";

import { Router, getExpressRouter } from "./framework/router";

import { Authing, Commenting, Following, Friending, Posting, Reacting, Sessioning } from "./app";
import { PostOptions } from "./concepts/posting";
import { SessionDoc } from "./concepts/sessioning";
import Responses from "./responses";

import { z } from "zod";

/**
 * Web server routes for the app. Implements synchronizations between concepts.
 */
class Routes {
  // Synchronize the concepts from `app.ts`.

  @Router.get("/session")
  async getSessionUser(session: SessionDoc) {
    const user = Sessioning.getUser(session);
    return await Authing.getUserById(user);
  }

  @Router.get("/users")
  async getUsers() {
    return await Authing.getUsers();
  }

  @Router.get("/users/:username")
  @Router.validate(z.object({ username: z.string().min(1) }))
  async getUser(username: string) {
    return await Authing.getUserByUsername(username);
  }

  @Router.post("/users")
  async createUser(session: SessionDoc, username: string, password: string) {
    Sessioning.isLoggedOut(session);
    return await Authing.create(username, password);
  }

  @Router.patch("/users/username")
  async updateUsername(session: SessionDoc, username: string) {
    const user = Sessioning.getUser(session);
    return await Authing.updateUsername(user, username);
  }

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

  @Router.post("/login")
  async logIn(session: SessionDoc, username: string, password: string) {
    const u = await Authing.authenticate(username, password);
    Sessioning.start(session, u._id);
    return { msg: "Logged in!" };
  }

  @Router.post("/logout")
  async logOut(session: SessionDoc) {
    Sessioning.end(session);
    return { msg: "Logged out!" };
  }

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

  @Router.post("/posts")
  async createPost(session: SessionDoc, content: string, options?: PostOptions) {
    const user = Sessioning.getUser(session);
    const created = await Posting.create(user, content, options);
    return { msg: created.msg, post: await Responses.post(created.post) };
  }

  @Router.patch("/posts/:id")
  async updatePost(session: SessionDoc, id: string, content?: string, options?: PostOptions) {
    const user = Sessioning.getUser(session);
    const oid = new ObjectId(id);
    await Posting.assertAuthorIsUser(oid, user);
    return await Posting.update(oid, content, options);
  }

  @Router.delete("/posts/:id")
  async deletePost(session: SessionDoc, id: string) {
    const user = Sessioning.getUser(session);
    const oid = new ObjectId(id);
    await Posting.assertAuthorIsUser(oid, user);
    return Posting.delete(oid);
  }

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

  @Router.get("/comments/parent")
  async getCommentsByParent(parent: string) {
    const parentOid = new ObjectId(parent);
    return Responses.comments(await Commenting.getByParent(parentOid));
  }

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
    return { msg: created.msg, comment: await Responses.comment(created.comment) };
  }

  @Router.delete("/comments/:id")
  async deleteComment(session: SessionDoc, id: string) {
    const user = Sessioning.getUser(session);
    const oid = new ObjectId(id);
    await Commenting.assertAuthorIsUser(oid, user);
    return Commenting.delete(oid);
  }

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

  @Router.get("/reactions/item")
  async getReactionsByItem(item: string) {
    const itemOid = new ObjectId(item);
    return Responses.reactions(await Reacting.getByItem(itemOid));
  }

  @Router.post("/reactions")
  async createReaction(session: SessionDoc, type: string, item: string) {
    const user = Sessioning.getUser(session);
    const itemOid = new ObjectId(item);
    try {
      await Posting.assertPostExists(itemOid);
    } catch {
      await Commenting.assertCommentExists(itemOid);
    }
    const created = await Reacting.create(user, type, itemOid);
    return { msg: created.msg, reaction: await Responses.reaction(created.reaction) };
  }

  @Router.delete("/reactions/:id")
  async deleteReaction(session: SessionDoc, id: string) {
    const user = Sessioning.getUser(session);
    const oid = new ObjectId(id);
    await Reacting.assertAuthorIsUser(oid, user);
    return Reacting.delete(oid);
  }

  // TODO for Beta: delete friending concept (will use following concept instead)

  @Router.get("/friends")
  async getFriends(session: SessionDoc) {
    const user = Sessioning.getUser(session);
    return await Authing.idsToUsernames(await Friending.getFriends(user));
  }

  @Router.delete("/friends/:friend")
  async removeFriend(session: SessionDoc, friend: string) {
    const user = Sessioning.getUser(session);
    const friendOid = (await Authing.getUserByUsername(friend))._id;
    return await Friending.removeFriend(user, friendOid);
  }

  @Router.get("/friend/requests")
  async getRequests(session: SessionDoc) {
    const user = Sessioning.getUser(session);
    return await Responses.friendRequests(await Friending.getRequests(user));
  }

  @Router.post("/friend/requests/:to")
  async sendFriendRequest(session: SessionDoc, to: string) {
    const user = Sessioning.getUser(session);
    const toOid = (await Authing.getUserByUsername(to))._id;
    return await Friending.sendRequest(user, toOid);
  }

  @Router.delete("/friend/requests/:to")
  async removeFriendRequest(session: SessionDoc, to: string) {
    const user = Sessioning.getUser(session);
    const toOid = (await Authing.getUserByUsername(to))._id;
    return await Friending.removeRequest(user, toOid);
  }

  @Router.put("/friend/accept/:from")
  async acceptFriendRequest(session: SessionDoc, from: string) {
    const user = Sessioning.getUser(session);
    const fromOid = (await Authing.getUserByUsername(from))._id;
    return await Friending.acceptRequest(fromOid, user);
  }

  @Router.put("/friend/reject/:from")
  async rejectFriendRequest(session: SessionDoc, from: string) {
    const user = Sessioning.getUser(session);
    const fromOid = (await Authing.getUserByUsername(from))._id;
    return await Friending.rejectRequest(fromOid, user);
  }

  /**
   * TODO for Beta: implement Following concept
   */

  // get a user's followers
  @Router.get("/followers")
  async getFollowers(username: string) {
    const userOid = (await Authing.getUserByUsername(username))._id;
    return await Responses.follows(await Following.getFollowers(userOid));
  }

  // get who a user is following
  @Router.get("/following")
  async getFollowing(username: string) {
    const userOid = (await Authing.getUserByUsername(username))._id;
    return await Responses.follows(await Following.getFollowing(userOid));
  }

  // follow a user by username
  @Router.post("/follow")
  async follow(session: SessionDoc, username: string) {
    const user = Sessioning.getUser(session);
    const followeeOid = (await Authing.getUserByUsername(username))._id;
    return await Following.follow(user, followeeOid);
  }

  // unfollow a user by username
  @Router.delete("/follow")
  async unfollow(session: SessionDoc, username: string) {
    const user = Sessioning.getUser(session);
    const followeeOid = (await Authing.getUserByUsername(username))._id;
    return await Following.unfollow(user, followeeOid);
  }

  /**
   * TODO for Beta: implement Scoring concept
   *
   * Note:
   *
   * During A4 Beta, I will synchronize the creation of an item's score when the item is created.
   * e.g. I will sync the creationg of a post's score when a post is created.
   * e.g. I will sync the creationg of a user's score when the user registers.
   *
   * Thus, the Scoring concept does not need api endpoints for creating scores (since that is done elsewhere).
   *
   * The scoring concept is simple for storing, viewing, and updating scores.
   * The actual algorithm/formula for calculating scores will be done in a seperate app-level function/feature.
   */

  // get the score of the current session user
  @Router.get("/score")
  async getScore(session: SessionDoc) {
    throw new Error("TODO for Beta: not implemented");
  }

  // get the score of any user by item (user, post, or comment)
  @Router.get("/score/:item")
  async getScoreByItem(item: string) {
    throw new Error("TODO for Beta: not implemented");
  }

  // update the score of any user by item (user, post, or comment)
  @Router.patch("/score/:item")
  async updateScoreByItem(session: SessionDoc, item: string, score: number) {
    throw new Error("TODO for Beta: not implemented");
  }
}

/** The web app. */
export const app = new Routes();

/** The Express router. */
export const appRouter = getExpressRouter(app);
