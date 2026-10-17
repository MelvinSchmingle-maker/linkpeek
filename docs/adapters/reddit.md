# Reddit adapter: research (not built)

- **Official API:** Reddit has a data API. Its terms and prices were **not verified**: the terms page couldn't be fetched from here (https://www.redditinc.com/policies/data-api-terms gave an error).
- **Without an API:** LinkPeek could read a post from the page the user already has open. A link to another post is fetched by the general reader, which Reddit answers with a login page (the live check showed this for old.reddit.com).
- **Login:** the plan's comment view needs the public JSON or the page, neither of which we could confirm is allowed.
- **Chrome Web Store:** not checked.
- **Recommendation:** skip for now. Before any build, read Reddit's developer terms and API terms on Reddit's own pages, check whether caching or summarising the content is allowed, and then decide with the owner.
- **Not built.** Nothing fetches Reddit by a special path.
