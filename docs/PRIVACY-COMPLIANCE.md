# Privacy & Compliance Guidelines

This guide captures the baseline policies for handling member data within the UAW 1284 membership server.

## 1. Data Retention Schedule

| Record Type | Retention | Notes |
| --- | --- | --- |
| Active member profile | While membership is active + 7 years | Covers grievance windows and benefit lookups. |
| Former member profile | 7 years after departure | Review annually for archival or anonymization. |
| Audit logs | 3 years | Needed for investigations and compliance reviews. |
| Export logs | 1 year | Keeps track of who downloaded sensitive data. |

Store retention decisions in an ops tracker (ticketing tool or spreadsheet). Automate purge jobs as the database matures (e.g., nightly script that anonymizes or deletes records past the retention date).

## 2. Data Minimization

- Collect only the attributes required for membership administration (CID, UID, contact info, dues status, etc.).
- Avoid storing SSNs, financial account numbers, or unnecessary personal data in the application database. If these fields are unavoidable, encrypt them at the application layer.
- Restrict access to exports by enforcing RBAC (already in place) and logging every export request.

## 3. Encryption & Storage

- Enable disk-level encryption on the MongoDB volume (LUKS, AWS EBS encryption, etc.).
- For managed services (Atlas, DocumentDB), ensure encryption-at-rest and TLS in transit are enabled.
- Rotate credentials regularly and store them in a secure secret manager (AWS Secrets Manager, Vault, Doppler, etc.).

## 4. Least-Privilege Database Accounts

- Create dedicated MongoDB users for the application and admin tooling.
- Grant only the roles required: the app user typically needs `readWrite` on the membership database; admin users can receive `dbAdmin` or `backup` as needed.
- When running migrations or scripts, use scoped credentials that expire after the job completes.

## 5. Deletion / Anonymization Workflow

Implement a standard process for privacy requests (e.g., “remove my data” or “anonymize after departure”):

1. Record the request in the helpdesk/CRM with a due date.
2. Validate the requester’s identity via union procedures.
3. Execute an anonymization script that clears PII fields but retains aggregate metrics (e.g., keep `status` and `joinDate`, drop `email`/`address`).
4. Log the action in the AuditLog model and confirm completion with the requester.

## 6. Auditing & Reviews

- Perform semiannual privacy reviews to confirm the retention plan and minimization practices still meet union/legal requirements.
- Update this document whenever new data categories or regulations apply (e.g., state privacy laws).

The objective is to keep the membership database lean, well-protected, and ready for compliance audits. Coordinate with union leadership and legal counsel to adapt these policies as regulations change.
