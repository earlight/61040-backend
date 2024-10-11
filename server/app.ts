import AuthenticatingConcept from "./concepts/authenticating";
import CommentingConcept from "./concepts/commenting";
import FollowingConcept from "./concepts/following";
import FriendingConcept from "./concepts/friending";
import PostingConcept from "./concepts/posting";
import ReactingConcept from "./concepts/reacting";
import SessioningConcept from "./concepts/sessioning";

// The app is a composition of concepts instantiated here
// and synchronized together in `routes.ts`.
export const Sessioning = new SessioningConcept();
export const Authing = new AuthenticatingConcept("users");
export const Posting = new PostingConcept("posts");
export const Friending = new FriendingConcept("friends");
export const Commenting = new CommentingConcept("comments");
export const Reacting = new ReactingConcept("reactions");
export const Following = new FollowingConcept("follows");
