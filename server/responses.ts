import { Authing } from "./app";
import { CommentAuthorNotMatchError, CommentDoc } from "./concepts/commenting";
import { AlreadyFollowingError, FollowDoc, NotFollowingError, SelfFollowError, SelfUnfollowError } from "./concepts/following";
import { PostAuthorNotMatchError, PostDoc } from "./concepts/posting";
import { ReactionAuthorNotMatchError, ReactionDoc } from "./concepts/reacting";
import { Router } from "./framework/router";

/**
 * This class does useful conversions for the frontend.
 * For example, it converts a {@link PostDoc} into a more readable format for the frontend.
 */
export default class Responses {
  /**
   * Convert PostDoc into more readable format for the frontend by converting the author id into a username.
   */
  static async post(post: PostDoc | null) {
    if (!post) {
      return post;
    }
    const author = await Authing.getUserById(post.author);
    return { ...post, author: author.username };
  }

  /**
   * Same as {@link post} but for an array of PostDoc for improved performance.
   */
  static async posts(posts: PostDoc[]) {
    const authors = await Authing.idsToUsernames(posts.map((post) => post.author));
    return posts.map((post, i) => ({ ...post, author: authors[i] }));
  }

  /**
   * Convert CommentDoc into more readable format for the frontend by converting the author id into a username.
   */
  static async comment(comment: CommentDoc | null) {
    if (!comment) {
      return comment;
    }
    const author = await Authing.getUserById(comment.author);
    return { ...comment, author: author.username };
  }

  /**
   * Same as {@link comment} but for an array of CommentDoc for improved performance.
   */
  static async comments(comments: CommentDoc[]) {
    const authors = await Authing.idsToUsernames(comments.map((comment) => comment.author));
    return comments.map((comment, i) => ({ ...comment, author: authors[i] }));
  }

  /**
   * Convert ReactionDoc into more readable format for the frontend by converting the author id into a username.
   */
  static async reaction(reaction: ReactionDoc | null) {
    if (!reaction) {
      return reaction;
    }
    const author = await Authing.getUserById(reaction.author);
    return { ...reaction, author: author.username };
  }

  /**
   * Same as {@link reaction} but for an array of ReactionDoc for improved performance.
   */
  static async reactions(reactions: ReactionDoc[]) {
    const authors = await Authing.idsToUsernames(reactions.map((reaction) => reaction.author));
    return reactions.map((reaction, i) => ({ ...reaction, author: authors[i] }));
  }

  /**
   * Convert FollowDoc into more readable format for the frontend
   * by converting the ids into usernames.
   */
  static async follows(follows: FollowDoc[]) {
    const followers = follows.map((follow) => follow.follower);
    const followees = follows.map((follow) => follow.followee);
    const usernames = await Authing.idsToUsernames(followers.concat(followees));
    return follows.map((follow, i) => ({ ...follow, follower: usernames[i], followee: usernames[i + follows.length] }));
  }
}

Router.registerError(PostAuthorNotMatchError, async (e) => {
  const username = (await Authing.getUserById(e.author)).username;
  return e.formatWith(username, e._id);
});

Router.registerError(CommentAuthorNotMatchError, async (e) => {
  const username = (await Authing.getUserById(e.author)).username;
  return e.formatWith(username, e._id);
});

Router.registerError(ReactionAuthorNotMatchError, async (e) => {
  const username = (await Authing.getUserById(e.author)).username;
  return e.formatWith(username, e._id);
});

Router.registerError(AlreadyFollowingError, async (e) => {
  const [follower, followee] = await Promise.all([Authing.getUserById(e.follower), Authing.getUserById(e.followee)]);
  return e.formatWith(follower.username, followee.username);
});

Router.registerError(NotFollowingError, async (e) => {
  const [follower, followee] = await Promise.all([Authing.getUserById(e.follower), Authing.getUserById(e.followee)]);
  return e.formatWith(follower.username, followee.username);
});

Router.registerError(SelfFollowError, async (e) => {
  const user = await Authing.getUserById(e.user);
  return e.formatWith(user.username);
});

Router.registerError(SelfUnfollowError, async (e) => {
  const user = await Authing.getUserById(e.user);
  return e.formatWith(user.username);
});
