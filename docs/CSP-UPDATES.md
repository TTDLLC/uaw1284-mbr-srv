# Content Security Policy (CSP) Update Guide

This project ships with a tight CSP via Helmet (see `server/index.js`). Follow the process below whenever you need to allow new sources or script behaviors.

1. **Capture the requirement**  
   - Document who is requesting the change, what asset/host must be added, and why it is needed.  
   - Confirm whether the integration can run through existing assets (preferred).

2. **Assess the risk**  
   - Determine which Helmet directive must change (e.g., `scriptSrc`, `imgSrc`).  
   - Identify the narrowest host/path wildcard that satisfies the requirement.  
   - Note if the change is temporary and schedule its removal.

3. **Implement**  
   - Update the `helmet({ contentSecurityPolicy })` block in `server/index.js`.  
   - Keep directives sorted and comment inline when a host has unique rationale.  
   - For temporary allowances, add a `TODO` with the removal date/owner.

4. **Verify**  
   - Run the app locally (`npm run dev`) and exercise the affected feature.  
   - Inspect browser dev tools for CSP violations or console warnings.  
   - Capture the manual test evidence (screenshots/logs) in the change request.

5. **Record and ship**  
   - Mention the CSP delta in the pull-request description/change log.  
   - Update the operations runbook if the new host needs firewall or proxy changes.

Re-run this checklist for every CSP tweak so that security reviewers can quickly reason about each allowance.
