# AWS SES Setup Guide for Kartavaya

## Why AWS SES?

**SendGrid vs AWS SES Comparison:**

| Feature | SendGrid Free | AWS SES Free Tier |
|---------|--------------|------------------|
| **Free emails/month** | 100/day (3,000/month) | **3,000/month FOREVER** or 62,000/month for 12 months from EC2 |
| **Cost after free** | $19.95/mo for 50k emails | **$0.10 per 1,000 emails** (10x cheaper) |
| **Deliverability** | Good | **Excellent** |
| **DNS Records** | 3 CNAMEs | TXT + MX + DKIM |

**Recommendation:** AWS SES is superior - more free emails, 10x cheaper at scale, better deliverability.

---

## Step 1: Create AWS Account

1. Go to https://aws.amazon.com/
2. Click "Create an AWS Account"
3. Fill in:
   - Email address
   - Account name: "Kartavaya Production"
   - Password
4. Add payment method (won't be charged in free tier)
5. Verify phone number
6. Select **Free tier** support plan

---

## Step 2: Set Up AWS SES

### 2.1 Access SES Console
1. Login to AWS Console: https://console.aws.amazon.com/
2. Search for "SES" (Simple Email Service)
3. Select region: **us-east-1** (N. Virginia) - recommended
4. Click "Get started"

### 2.2 Verify Domain

1. Click **"Identities"** → **"Create identity"**
2. Select **"Domain"**
3. Enter your domain: `yourdomain.com` (e.g., `Kartavaya.app`)
4. Leave "Use a custom MAIL FROM domain" unchecked
5. Click **"Create identity"**

### 2.3 Add DNS Records

AWS will provide you with DNS records. You need to add these to your domain registrar (GoDaddy, Namecheap, Cloudflare, etc.):

#### **Record 1: Domain Verification (TXT)**
```
Type: TXT
Name: _amazonses.yourdomain.com
Value: [Long verification string from AWS - copy exactly]
TTL: 1800 (or default)
```

#### **Record 2: MX for Feedback (MX)**
```
Type: MX
Name: yourdomain.com (or @ for root domain)
Value: 10 feedback-smtp.us-east-1.amazonses.com
Priority: 10
TTL: 1800
```

#### **Record 3-5: DKIM Authentication (3 TXT records)**
AWS will give you 3 DKIM records that look like:
```
Type: TXT
Name: abc123._domainkey.yourdomain.com
Value: abc123.dkim.amazonses.com
TTL: 1800

Type: TXT
Name: def456._domainkey.yourdomain.com
Value: def456.dkim.amazonses.com
TTL: 1800

Type: TXT
Name: ghi789._domainkey.yourdomain.com
Value: ghi789.dkim.amazonses.com
TTL: 1800
```

**Important:** Copy the exact values from AWS Console - don't use these examples!

### 2.4 Wait for Verification
- DNS propagation takes 10 minutes to 48 hours (usually ~1 hour)
- Check status in AWS Console → Identities → Your domain
- Status should change from "Pending" to "Verified" with green checkmark

---

## Step 3: Request Production Access

**By default, AWS SES starts in SANDBOX mode:**
- Can only send to verified email addresses
- Limited to 200 emails/day

**To send to any email address:**

1. Go to SES Console → **"Account dashboard"**
2. Click **"Request production access"**
3. Fill out the form:
   - **Mail type:** Transactional
   - **Website URL:** https://Kartavaya-aekam.vercel.app
   - **Use case description:**
     ```
     Kartavaya is a task management platform that sends:
     1. Task assignment notifications to team members
     2. Approval workflow notifications (pending/approved/rejected)
     3. Team invitation emails
     4. Task reminder emails for due dates
     
     All emails are transactional (user-triggered actions), not marketing.
     Expected volume: 500-2,000 emails/month.
     Users opt-in by creating accounts and can unsubscribe anytime.
     ```
   - **Will you comply with AWS Acceptable Use Policy?** Yes
   - **Process bounces and complaints?** Yes (handled via MX record)
   - **How will you handle bounces?** 
     ```
     We will:
     1. Monitor bounce notifications via AWS SNS
     2. Automatically remove hard-bounced emails from our system
     3. Retry soft bounces up to 3 times
     4. Maintain bounce rate below 5%
     ```

4. Click **"Submit request"**
5. AWS usually approves within **24 hours**
6. You'll receive email confirmation

---

## Step 4: Create SMTP Credentials

1. Go to SES Console → **"SMTP settings"**
2. Click **"Create SMTP credentials"**
3. IAM User Name: `Kartavaya-ses-smtp`
4. Click **"Create user"**
5. **IMPORTANT:** Download the credentials CSV file
   - SMTP Username: `AKIAxxxxxxxxxx`
   - SMTP Password: `BGxxxxxxxxxxxxxxxxxx`
   - **Save these securely - you can't retrieve the password later!**

---

## Step 5: Update Backend Environment Variables

### On Railway (Production):

1. Go to Railway Dashboard: https://railway.app/
2. Select your `Kartavaya` project → `backend` service
3. Go to **"Variables"** tab
4. Add these environment variables:

```bash
# AWS SES Configuration
AWS_ACCESS_KEY_ID=AKIAxxxxxxxxxx          # From SMTP credentials
AWS_SECRET_ACCESS_KEY=BGxxxxxxxxxxxxxxxxxx # From SMTP credentials
AWS_REGION=us-east-1
FROM_EMAIL=noreply@yourdomain.com          # Must match verified domain

# Keep SendGrid as fallback (optional)
SENDGRID_API_KEY=SG.xxxxxxxx              # Keep existing if you want fallback
```

5. Click **"Deploy"** to restart with new variables

### Local Development (.env):

```bash
# backend/.env
AWS_ACCESS_KEY_ID=AKIAxxxxxxxxxx
AWS_SECRET_ACCESS_KEY=BGxxxxxxxxxxxxxxxxxx
AWS_REGION=us-east-1
FROM_EMAIL=noreply@yourdomain.com
```

---

## Step 6: Install boto3 (AWS SDK)

The backend code already supports AWS SES. Just install boto3:

```bash
cd backend/
pip install boto3
pip freeze > requirements.txt
```

Commit and push `requirements.txt`:
```bash
git add requirements.txt
git commit -m "Add boto3 for AWS SES support"
git push
```

Railway will auto-deploy with boto3 installed.

---

## Step 7: Test Email Sending

### Test in AWS Console:
1. Go to SES Console → **"Identities"** → Your domain
2. Click **"Send test email"**
3. Enter:
   - From: `noreply@yourdomain.com`
   - To: Your email address
   - Subject: "Test from AWS SES"
   - Body: "If you receive this, AWS SES is working!"
4. Click **"Send test email"**
5. Check your inbox (and spam folder)

### Test via Backend API:
1. Login to Kartavaya: https://Kartavaya-aekam.vercel.app/
2. Create a test task and assign it to someone
3. Check if they receive the email notification
4. Check Railway logs:
   ```
   Email sent via AWS SES to user@example.com: [MessageId]
   ```

---

## Step 8: Monitor Email Metrics

1. Go to SES Console → **"Reputation dashboard"**
2. Monitor:
   - **Bounce rate:** Keep below 5% (ideally <2%)
   - **Complaint rate:** Keep below 0.1%
   - **Sending quota:** Track daily usage

3. Set up CloudWatch Alarms (optional):
   - Bounce rate > 5%
   - Complaint rate > 0.1%
   - Daily send quota approaching limit

---

## Troubleshooting

### ❌ "Email address not verified" (Sandbox Mode)
**Solution:** Request production access (Step 3)

### ❌ DNS records not verifying
**Solution:**
- Wait 24-48 hours for DNS propagation
- Use `dig` to check records:
  ```bash
  dig TXT _amazonses.yourdomain.com
  dig TXT abc123._domainkey.yourdomain.com
  ```
- Ensure no typos in DNS records
- Check with your DNS provider's support

### ❌ Emails going to spam
**Solution:**
- Ensure all DKIM records are added correctly
- Add SPF record:
  ```
  Type: TXT
  Name: yourdomain.com
  Value: v=spf1 include:amazonses.com ~all
  ```
- Request DMARC setup (optional but recommended)

### ❌ boto3 import error
**Solution:**
```bash
pip install boto3
# Or add to requirements.txt and redeploy
```

### ❌ Rate limiting / throttling
**Solution:**
- Check sending quota in SES Console
- Free tier: 3,000 emails/month
- If exceeded, emails will queue or fail
- Upgrade to paid tier ($0.10/1k emails)

---

## Cost Breakdown

### Free Tier (First 12 months):
- **From EC2:** 62,000 emails/month FREE
- **From anywhere:** 3,000 emails/month FREE (FOREVER)

### After Free Tier:
- **$0.10 per 1,000 emails** sent
- **$0.12 per 1,000 emails** received (not applicable for Kartavaya)
- **No monthly fees**

### Example Costs:
| Usage | SendGrid Cost | AWS SES Cost | Savings |
|-------|--------------|--------------|--------|
| 3,000/month | FREE | FREE | - |
| 10,000/month | $19.95 | $0.70 | 96% cheaper |
| 50,000/month | $19.95 | $4.70 | 76% cheaper |
| 100,000/month | $79.95 | $9.70 | 88% cheaper |

---

## Security Best Practices

1. **Never commit AWS credentials to Git**
   - Use environment variables only
   - Add `.env` to `.gitignore`

2. **Use IAM user with minimal permissions**
   - The SMTP user created has only SES send permissions
   - Don't use root AWS account credentials

3. **Rotate credentials annually**
   - Create new SMTP credentials
   - Update Railway variables
   - Delete old credentials

4. **Monitor for abuse**
   - Set up CloudWatch alarms
   - Review bounce/complaint rates weekly
   - Investigate any spikes immediately

---

## Next Steps After Setup

1. ✅ Verify domain in AWS SES
2. ✅ Add all DNS records
3. ✅ Request production access
4. ✅ Create SMTP credentials
5. ✅ Update Railway environment variables
6. ✅ Install boto3 in requirements.txt
7. ✅ Test email sending
8. ✅ Monitor metrics for first week

---

## Support

- **AWS SES Documentation:** https://docs.aws.amazon.com/ses/
- **AWS Support:** https://console.aws.amazon.com/support/
- **Kartavaya Issues:** https://github.com/kevalvshah/Kartavaya/issues

---

**Implementation Status:**
- ✅ Backend code supports AWS SES (email_service.py)
- ✅ Fallback to SendGrid if AWS SES fails
- ⏳ Add boto3 to requirements.txt
- ⏳ Set up AWS account and verify domain
- ⏳ Update Railway environment variables
