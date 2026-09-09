## Due Soon | WPI assignment tracker

https://a3-ryangriffin.onrender.com/

Due Soon is a single-page coursework tracker for WPI assignments. Each logged-in user tracks their own assignments (title, course, due date, estimated hours, priority) with derived days-remaining and urgency, and can add, edit, and delete entries. The server stores the data per user in MongoDB.

- **Goal:** help WPI students track assignments in one place and see what is due soon.
- **Challenges:** scope all CRUD by username with session auth; move all custom CSS to Bootstrap utilities; fix the `hidden` attribute losing to `display:grid`/`flex` with an explicit `[hidden]` rule.
- **Authentication:** username and password with `express-session`. The server creates new accounts on first login. I chose this because its a simple baseline that meets the per-user requirement.
- **CSS framework:** Bootstrap via CDN. It has styling for the layout (`container/row/col`), cards, tables, forms, buttons, and alerts. Custom CSS has 5 lines, a `[hidden]` override only.

## Technical achievements

- **Middleware:** `express-session` stores login state on the server.

### Design/evaluation achievements

- None. Lighthouse: 99 Performance, 100 Best Practices, 100 Accessibility, 100 SEO.
