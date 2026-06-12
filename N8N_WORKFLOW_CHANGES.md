# N8N Workflow Changes - Tracking Document

This document tracks all n8n workflow modifications needed to support the dashboard features.

## 🔄 Pending N8N Changes

### 1. Touchpoint Booking Tracking (Priority: HIGH)

**Workflow:** S4 - Nurture Sequence (7-touch follow-up)

**What to add:** When a lead books an appointment during the nurture sequence, log which touchpoint triggered the booking.

**Implementation:**
- After each touchpoint (email/SMS/WhatsApp), check if lead status changed to "booked"
- If booked, create an activity log entry:

```json
POST /api/v1/automation/activity-log
{
  "leadId": "{{$json.leadId}}",
  "action": "booked_after_nurture",
  "payload": {
    "touchIndex": 2,  // 1-7 depending on which touch
    "touchType": "email",  // or "sms", "whatsapp"
    "fromStage": "nurture",
    "toStage": "booked"
  }
}
```

**Dashboard Impact:** 
- Enables the "Booking Touchpoint Breakdown" chart on Live Funnel
- Shows which touches are most effective at converting
- Helps optimize nurture sequence

**Status:** ⏳ Pending

---

### 2. S7 - Dormant Reactivation Status Updates

**Workflow:** S7 - Dormant Lead Reactivation

**What to add:** When a dormant lead responds to reactivation attempts, update their status to "reactivated"

**Implementation:**
- After successful reactivation contact, call:

```json
POST /api/v1/automation/leads/{{leadId}}/mark-reactivated
{
  "note": "Responded to reactivation email",
  "reactivationAttempt": 1  // or 2, 3, etc.
}
```

**Dashboard Impact:**
- Tracks reactivation success rate
- Shows "Reactivated this week" metric on Overview
- Enables reactivation ROI analysis

**Status:** ⏳ Pending

---

## ✅ Completed N8N Integrations

### Workflow Heartbeat Pings
- All workflows sending heartbeat pings to `/api/v1/automation/workflow-heartbeat`
- S4B cron pings are deduplicated on dashboard

### Lead Scoring
- Scoring workflow (S2) properly updating lead scores via `/api/v1/automation/leads/:id/score`

### Follow-Up Queue
- S4 workflow creating follow-up tasks in `follow_up_queue` table
- Dashboard displays all pending/due follow-ups

---

## 📋 Future N8N Enhancements (Not Urgent)

### Enhanced Error Tracking
- Log detailed error information when workflows fail
- Include error codes, retry attempts, and failure reasons

### Booking Confirmation Tracking
- Track when booking confirmations are sent
- Monitor booking confirmation open/click rates

### No-Show Prediction
- Add ML model to predict no-show likelihood
- Trigger preventive actions for high-risk bookings

---

## Notes for Implementation

- **Testing:** Always test workflow changes in a development/staging n8n instance first
- **Logging:** Use the activity log API for all significant lead state changes
- **Consistency:** Follow the existing payload structure for all API calls
- **Error Handling:** Always include try-catch blocks and error logging
- **Monitoring:** Ensure workflow heartbeat pings are sent after each major workflow completion

---

**Last Updated:** 2026-06-12 03:55 AM
**Next Review:** After S4 and S7 updates are implemented

---

## 🚨 CRITICAL: Pipeline Stage Management

### Problem
Currently, all 23 leads are stuck in "contacted" stage even though:
- They have follow-ups scheduled (nurture sequence active)
- Some may have booked appointments
- The Live Funnel shows 0 leads in nurture, booked, etc.

### Root Cause
The n8n workflows are **NOT updating the `pipelineStage` field** when leads progress through the funnel.

### Solution: Update Pipeline Stages at Key Events

#### S4 - Nurture Sequence
**When:** First nurture touch is sent (Touch #1)
**Action:** Update lead stage from "contacted" → "nurture"
```
POST /api/v1/automation/leads/{leadId}/mark-contacted
{
  "stage": "nurture"
}
```

#### S4/S6 - Booking Workflows
**When:** Lead books an appointment (Calendly webhook fires)
**Action:** Update lead stage to "booked"
```
POST /api/v1/automation/leads/{leadId}/mark-contacted
{
  "stage": "booked"
}
```

#### All Workflows - Complete Stage Transition Map

| Trigger Event | Current Stage | New Stage | Workflow Responsible |
|--------------|---------------|-----------|---------------------|
| Lead ingested & scored | new | contacted | S1/S2/S3 (after first contact) |
| First nurture touch sent | contacted | nurture | S4 (after sending touch #1) |
| Appointment booked | nurture/contacted | booked | S4/S6 (Calendly webhook) |
| Appointment confirmed by admin | booked | audit_booked | Manual or webhook |
| Lead doesn't show for appointment | audit_booked | no_show | Manual/S8 |
| Deal closed successfully | audit_booked | closed/client | Manual workflow |
| Lead goes completely cold/dormant | any | dead | S7 trigger logic |
| Dormant lead responds to reactivation | dead | reactivated | S7 (after response) |

**Priority:** CRITICAL - Without this, the Live Funnel will always show empty stages!

**Implementation Note:** Use the existing `/mark-contacted` endpoint - it accepts any valid stage name in the `stage` parameter.
