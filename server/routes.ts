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
    const created = await Authing.create(username, password);
    if (created.user) {
      Scoring.create(created.user._id);
    }
    return created;
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
    if (created.post) {
      Scoring.create(created.post._id);
    }
    return { msg: created.msg, post: await Responses.post(created.post) };
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
    if (created.comment) {
      Scoring.create(created.comment._id);
    }
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

  // get the score of any item by ObjectId (empty for all items)
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

  // update the score of an item by ObjectId
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
