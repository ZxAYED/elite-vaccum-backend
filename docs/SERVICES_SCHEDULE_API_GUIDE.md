# Elite Central Vacuum - Services & Schedule API Integration Guide

This guide details all backend endpoints, DTO contracts, authentication rules, and response payloads for the **Services & Schedule Management Domain** in the Elite Central Vacuum platform.

---

## 1. Domain Overview & Fixed Catalog

The platform provides **10 Fixed Services** divided into **2 Core Groups** with pre-configured symptom tags and icons.

### A. Group 1: `SERVICE_AND_MAINTENANCE`
| Slug | Service Name | Icon Key | Default Base Price | Recommended Symptoms |
| :--- | :--- | :--- | :--- | :--- |
| `vacuum-repair` | **Vacuum Repair** | `Wrench` | `$120.00` | `UNIT_NOT_TURNING_ON`, `UNIT_DOES_NOT_SHUT_OFF`, `NOISE`, `OTHER` |
| `maintenance-troubleshooting` | **Maintenance & Troubleshooting** | `Pulse` | `$95.00` | `LOW_SUCTION`, `NOISE`, `OTHER` |
| `low-suction-fix` | **Low Suction Fix** | `ShieldCheck` | `$140.00` | `LOW_SUCTION`, `CLOGGED`, `WALL_OR_POWER_HOSE_PROBLEM` |
| `broken-inlet-repair` | **Broken Inlet Repair** | `Sliders` | `$85.00` | `BROKEN_INLET`, `WALL_OR_POWER_HOSE_PROBLEM` |
| `general-service` | **General Service** | `Wrench` | `$110.00` | `LOW_SUCTION`, `NOISE`, `CLOGGED`, `OTHER` |
| `system-inspection` | **System Inspection** | `ShieldCheck` | `$75.00` | `OTHER` |

### B. Group 2: `INSTALLATION`
| Slug | Service Name | Icon Key | Default Base Price | Focus |
| :--- | :--- | :--- | :--- | :--- |
| `new-system` | **New System** | `Home` | `$1500.00` | New home construction blueprinting & installation |
| `custom-fit` | **Custom Fit** | `Wrench` | `$2200.00` | Bespoke layouts for commercial / custom spaces |
| `system-upgrade` | **System Upgrade** | `Upgrade` | `$850.00` | Power unit retrofits to existing piping lines |
| `architectural` | **Architectural** | `Compass` | `$3500.00` | Concealed & flush-mount luxury architectural integration |

### C. Available Symptom Checkboxes (`RequestSymptom`)
* `UNIT_NOT_TURNING_ON` ("Unit not turning on")
* `UNIT_DOES_NOT_SHUT_OFF` ("Unit does not shut off")
* `CLOGGED` ("Clogged")
* `LOW_SUCTION` ("Low suction")
* `WALL_OR_POWER_HOSE_PROBLEM` ("Wall or power hose problem")
* `BROKEN_INLET` ("Broken inlet")
* `NOISE` ("Noise")
* `OTHER` ("Other")

---

## 2. Public Service Catalog Endpoints

### `GET /services`
Returns all 10 fixed service offerings grouped by category along with symptom choices.
* **Access**: Public (No authentication required)
* **Response `200 OK`**:
```json
{
  "success": true,
  "data": {
    "serviceAndMaintenance": [
      {
        "id": "vacuum-repair",
        "key": "VACUUM_REPAIR",
        "slug": "vacuum-repair",
        "group": "SERVICE_AND_MAINTENANCE",
        "title": "Vacuum Repair",
        "iconKey": "Wrench",
        "summary": "Diagnostics and repair for suction loss, motor noise, and inlet issues.",
        "description": "Expert comprehensive diagnostic and field repair service for all central vacuum power units...",
        "sortOrder": 1,
        "basePriceUsd": "120.00",
        "recommendedSymptoms": ["UNIT_NOT_TURNING_ON", "UNIT_DOES_NOT_SHUT_OFF", "NOISE", "OTHER"],
        "status": "ACTIVE"
      }
      // ... remaining 5 service & maintenance items
    ],
    "installation": [
      {
        "id": "new-system",
        "key": "NEW_SYSTEM",
        "slug": "new-system",
        "group": "INSTALLATION",
        "title": "New System",
        "iconKey": "Home",
        "summary": "Full blueprinting and installation for new home constructions.",
        "description": "Turnkey engineering and installation of complete central vacuum systems...",
        "sortOrder": 7,
        "basePriceUsd": "1500.00",
        "recommendedSymptoms": [],
        "status": "ACTIVE"
      }
      // ... remaining 3 installation items
    ],
    "symptoms": [
      { "key": "UNIT_NOT_TURNING_ON", "label": "Unit not turning on" },
      { "key": "UNIT_DOES_NOT_SHUT_OFF", "label": "Unit does not shut off" },
      { "key": "CLOGGED", "label": "Clogged" },
      { "key": "LOW_SUCTION", "label": "Low suction" },
      { "key": "WALL_OR_POWER_HOSE_PROBLEM", "label": "Wall or power hose problem" },
      { "key": "BROKEN_INLET", "label": "Broken inlet" },
      { "key": "NOISE", "label": "Noise" },
      { "key": "OTHER", "label": "Other" }
    ]
  },
  "meta": {
    "totalServices": 10,
    "groups": [
      { "key": "SERVICE_AND_MAINTENANCE", "title": "Service & Maintenance", "count": 6 },
      { "key": "INSTALLATION", "title": "Installation Services", "count": 4 }
    ]
  }
}
```

---

### `GET /services/:slug`
Fetches individual service details and available options by slug (e.g. `low-suction-fix`).
* **Access**: Public
* **Response `200 OK`**:
```json
{
  "success": true,
  "data": {
    "id": "low-suction-fix",
    "key": "LOW_SUCTION_FIX",
    "slug": "low-suction-fix",
    "group": "SERVICE_AND_MAINTENANCE",
    "title": "Low Suction Fix",
    "iconKey": "ShieldCheck",
    "summary": "Specialized blockage removal and seal integrity checks for restored power.",
    "description": "High-pressure reverse air flushing, optical endoscopy camera line inspection...",
    "sortOrder": 3,
    "basePriceUsd": "140.00",
    "recommendedSymptoms": ["LOW_SUCTION", "CLOGGED", "WALL_OR_POWER_HOSE_PROBLEM"],
    "status": "ACTIVE",
    "symptoms": [ ... ]
  }
}
```

---

## 3. Customer Service Intake Workflow

### `POST /service-requests`
Submits a service intake request. Supports guest users (auto-provisions `Customer` with `LEAD` status) or authenticated users.
* **Access**: Public / Authenticated (`Bearer <token>`)
* **Request Body**:
```json
{
  "serviceSlug": "low-suction-fix",
  "fullName": "Jane Doe",
  "email": "jane.doe@example.com",
  "phone": "+1 (555) 234-5678",
  "address": "742 Evergreen Terrace",
  "city": "Springfield",
  "state": "OR",
  "zipCode": "97477",
  "problemLocation": "Basement & 2nd Floor",
  "preferredDate": "2026-09-15",
  "timeWindow": "09:00 AM - 11:00 AM",
  "problemDescription": "The central vacuum has almost zero suction upstairs and emits a high pitched whistle.",
  "symptoms": ["LOW_SUCTION", "CLOGGED", "WALL_OR_POWER_HOSE_PROBLEM"],
  "manufacturer": "Beam Central Vac",
  "modelNumber": "Serenity SC375",
  "serialNumber": "SN-98234-X",
  "unitLocation": "Attached Garage Wall",
  "attachments": [
    {
      "fileName": "damaged-inlet-valve.jpg",
      "fileType": "image/jpeg",
      "sizeBytes": 204800,
      "url": "https://bucket.s3.amazonaws.com/requests/image.jpg",
      "kind": "PHOTO",
      "category": "Wall Inlet",
      "note": "Photo showing cracked valve latch"
    }
  ],
  "additionalNotes": "Gate code is #4321. Friendly dog in backyard."
}
```
* **Response `201 Created`**:
```json
{
  "success": true,
  "message": "Service intake request submitted successfully",
  "businessId": "REQ-20260823-01042",
  "request": {
    "id": "e47b1234-5678-4321-9876-abcdef012345",
    "businessId": "REQ-20260823-01042",
    "title": "Low Suction Fix Request - Springfield, OR",
    "description": "The central vacuum has almost zero suction upstairs...",
    "status": "SUBMITTED",
    "urgency": "MEDIUM",
    "symptoms": ["LOW_SUCTION", "CLOGGED", "WALL_OR_POWER_HOSE_PROBLEM"],
    "preferredDate": "2026-09-15",
    "preferredTime": "09:00 AM - 11:00 AM",
    "propertyLabel": "Springfield, OR",
    "serviceAddress": {
      "address": "742 Evergreen Terrace",
      "city": "Springfield",
      "state": "OR",
      "zipCode": "97477",
      "problemLocation": "Basement & 2nd Floor",
      "contactName": "Jane Doe",
      "contactPhone": "+1 (555) 234-5678",
      "contactEmail": "jane.doe@example.com"
    },
    "requestedSchedule": {
      "preferredDate": "2026-09-15",
      "timeWindow": "09:00 AM - 11:00 AM",
      "submittedAt": "2026-08-23T12:00:00.000Z"
    },
    "currentSchedule": {
      "preferredDate": "2026-09-15",
      "timeWindow": "09:00 AM - 11:00 AM",
      "submittedAt": "2026-08-23T12:00:00.000Z"
    },
    "equipment": {
      "manufacturer": "Beam Central Vac",
      "modelNumber": "Serenity SC375",
      "serialNumber": "SN-98234-X",
      "unitLocation": "Attached Garage Wall"
    },
    "attachments": [
      {
        "id": "f58c2345-6789-5432-0987-bcdef0123456",
        "fileName": "damaged-inlet-valve.jpg",
        "fileType": "image/jpeg",
        "sizeBytes": 204800,
        "url": "https://bucket.s3.amazonaws.com/requests/image.jpg",
        "kind": "PHOTO",
        "category": "Wall Inlet",
        "note": "Photo showing cracked valve latch"
      }
    ],
    "submittedAt": "2026-08-23T12:00:00.000Z"
  }
}
```

---

### `GET /service-requests/me`
Lists all service intake and active requests submitted by the logged-in customer.
* **Access**: `CUSTOMER` (`Bearer <token>`)
* **Query Parameters**: `page`, `limit`, `status`, `search`
* **Response `200 OK`**:
```json
{
  "items": [
    {
      "id": "e47b1234-5678-4321-9876-abcdef012345",
      "businessId": "REQ-20260823-01042",
      "title": "Low Suction Fix Request - Springfield, OR",
      "status": "SUBMITTED",
      "preferredDate": "2026-09-15",
      "preferredTime": "09:00 AM - 11:00 AM",
      "symptoms": ["LOW_SUCTION", "CLOGGED"],
      "submittedAt": "2026-08-23T12:00:00.000Z"
    }
  ],
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 1,
    "totalPages": 1
  }
}
```

---

### `GET /service-requests/:id`
Retrieves full details of a service request by UUID or business ID (`REQ-XXXXX`).
* **Access**: `CUSTOMER` (Own requests) or `ADMIN`
* **Response `200 OK`**: Full request object including equipment, media attachments, schedule, and appointment history.

---

## 4. Admin Triage & Status Management

### `GET /service-requests`
Admin searchable and filterable triage list with **live KPI badge aggregations**.
* **Access**: `ADMIN` (`Bearer <token>`)
* **Query Parameters**: `page`, `limit`, `status`, `urgency`, `serviceSlug`, `search`, `dateFrom`, `dateTo`, `sortBy`, `sortOrder`
* **Response `200 OK`**:
```json
{
  "items": [ ... ],
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 24,
    "totalPages": 3,
    "kpi": {
      "submitted": 6,
      "underReview": 4,
      "accepted": 8,
      "rejected": 2,
      "scheduled": 4,
      "total": 24
    }
  }
}
```

---

### `PATCH /service-requests/:id/status`
Transitions a request to a new status (e.g. `UNDER_REVIEW`, `ACCEPTED`).
* **Access**: `ADMIN`
* **Request Body**:
```json
{
  "status": "UNDER_REVIEW",
  "notes": "Reviewed by dispatcher and assigned for preliminary quotation."
}
```
* **Response `200 OK`**: Updated request object.

---

### `POST /service-requests/:id/reject`
Rejects a request, records audit reasons and explanations into `ServiceRequestRejection`.
* **Access**: `ADMIN`
* **Request Body**:
```json
{
  "reason": "Out of service territory",
  "comments": "We currently do not service the requested county. Recommended local affiliate contact provided."
}
```
* **Response `200 OK`**: Request marked as `REJECTED` with audit history.

---

### `POST /service-requests/:id/attachments`
Appends additional photos/videos/docs to an active service request.
* **Access**: `CUSTOMER` or `ADMIN`
* **Request Body**:
```json
{
  "attachments": [
    {
      "fileName": "power-unit-label.jpg",
      "fileType": "image/jpeg",
      "sizeBytes": 182000,
      "url": "https://bucket.s3.amazonaws.com/requests/label.jpg",
      "kind": "PHOTO",
      "category": "Motor Label",
      "note": "Close-up of model and voltage rating plate"
    }
  ]
}
```

---

## 5. Schedule & Dispatch Management

### `GET /schedule/slots`
Calculates daily booking slot availability for a given date across the 5 standard daily time windows.
* **Access**: Public / Customer
* **Query Parameters**:
  * `date`: `YYYY-MM-DD` (Required, e.g. `2026-09-15`)
  * `technicianId`: UUID (Optional)
* **Response `200 OK`**:
```json
{
  "success": true,
  "date": "2026-09-15",
  "totalSlots": 5,
  "availableSlotsCount": 4,
  "bookedSlotsCount": 1,
  "slots": [
    {
      "slot": "09:00 AM - 11:00 AM",
      "startTime": "09:00 AM",
      "endTime": "11:00 AM",
      "isBooked": true,
      "status": "BOOKED",
      "bookedCount": 2,
      "availableCapacity": 0,
      "availableTechnicians": []
    },
    {
      "slot": "11:00 AM - 01:00 PM",
      "startTime": "11:00 AM",
      "endTime": "01:00 PM",
      "isBooked": false,
      "status": "FREE",
      "bookedCount": 0,
      "availableCapacity": 2,
      "availableTechnicians": [
        { "id": "t1-uuid", "displayName": "Alex Rivera", "phone": "+1-555-111-2222" },
        { "id": "t2-uuid", "displayName": "David Vance", "phone": "+1-555-333-4444" }
      ]
    },
    {
      "slot": "01:00 PM - 03:00 PM",
      "startTime": "01:00 PM",
      "endTime": "03:00 PM",
      "isBooked": false,
      "status": "FREE",
      "bookedCount": 1,
      "availableCapacity": 1,
      "availableTechnicians": [
        { "id": "t2-uuid", "displayName": "David Vance", "phone": "+1-555-333-4444" }
      ]
    },
    {
      "slot": "03:00 PM - 04:30 PM",
      "startTime": "03:00 PM",
      "endTime": "04:30 PM",
      "isBooked": false,
      "status": "FREE",
      "bookedCount": 0,
      "availableCapacity": 2,
      "availableTechnicians": [ ... ]
    },
    {
      "slot": "04:30 PM - 06:00 PM",
      "startTime": "04:30 PM",
      "endTime": "06:00 PM",
      "isBooked": false,
      "status": "FREE",
      "bookedCount": 0,
      "availableCapacity": 2,
      "availableTechnicians": [ ... ]
    }
  ]
}
```

---

### `GET /schedule/board`
Admin dispatch calendar overview between two dates with technician assignments and aggregated statistics.
* **Access**: `ADMIN` (`Bearer <token>`)
* **Query Parameters**:
  * `dateFrom`: `YYYY-MM-DD` (Required)
  * `dateTo`: `YYYY-MM-DD` (Required)
  * `technicianId`: UUID (Optional)
  * `status`: string (Optional)
* **Response `200 OK`**:
```json
{
  "success": true,
  "data": {
    "appointments": [
      {
        "id": "app-uuid-1",
        "status": "CONFIRMED",
        "startAt": "2026-09-15T09:00:00.000Z",
        "endAt": "2026-09-15T11:00:00.000Z",
        "adminNote": "Gate code #4321",
        "notes": "Bring replacement 2-inch PVC elbows",
        "technician": {
          "id": "t1-uuid",
          "displayName": "Alex Rivera",
          "phone": "+1-555-111-2222",
          "rating": "4.95"
        },
        "serviceRequest": {
          "id": "req-uuid-1",
          "businessId": "REQ-20260823-01042",
          "title": "Low Suction Fix Request - Springfield, OR",
          "serviceAddress": { ... },
          "customer": {
            "displayName": "Jane Doe",
            "email": "jane.doe@example.com",
            "phone": "+1 (555) 234-5678"
          }
        }
      }
    ],
    "technicians": [
      { "id": "t1-uuid", "displayName": "Alex Rivera", "rating": "4.95", "status": "ACTIVE" }
    ]
  },
  "meta": {
    "dateFrom": "2026-09-01",
    "dateTo": "2026-09-30",
    "total": 14,
    "stats": {
      "confirmed": 10,
      "rescheduled": 2,
      "completed": 1,
      "cancelled": 1,
      "unassigned": 1
    }
  }
}
```

---

### `POST /schedule` (Admin "Create Schedule" Modal)
Creates a confirmed appointment for a service request or order with automatic schedule conflict prevention.
* **Access**: `ADMIN`
* **Request Body**:
```json
{
  "serviceRequestId": "e47b1234-5678-4321-9876-abcdef012345",
  "date": "2026-09-15",
  "startTime": "09:00 AM",
  "endTime": "11:00 AM",
  "technicianId": "c72a7fa8-8924-4f01-a7eb-6237c569ef83",
  "adminNote": "Customer requested calling 30 minutes prior to arrival.",
  "notes": "Bring 2-inch standard replacement PVC sweep elbows."
}
```
* **Response `201 Created`**:
```json
{
  "success": true,
  "message": "Appointment successfully created and dispatched",
  "appointment": {
    "id": "app-uuid-1",
    "status": "CONFIRMED",
    "startAt": "2026-09-15T09:00:00.000Z",
    "endAt": "2026-09-15T11:00:00.000Z",
    "technicianId": "c72a7fa8-8924-4f01-a7eb-6237c569ef83",
    "adminNote": "Customer requested calling 30 minutes prior to arrival."
  }
}
```

---

### `PATCH /schedule/:appointmentId`
Reschedules an appointment, updates time window, status, or instructions with conflict prevention.
* **Access**: `ADMIN`
* **Request Body**:
```json
{
  "date": "2026-09-16",
  "startTime": "01:00 PM",
  "endTime": "03:00 PM",
  "adminNote": "Rescheduled per customer request."
}
```

---

### `POST /schedule/:appointmentId/assign`
Assigns or reassigns a technician to a scheduled appointment.
* **Access**: `ADMIN`
* **Request Body**:
```json
{
  "technicianId": "c72a7fa8-8924-4f01-a7eb-6237c569ef83",
  "adminNote": "Assigned based on territory proximity."
}
```

---

### `POST /schedule/:appointmentId/cancel`
Cancels an appointment with an audit reason.
* **Access**: `ADMIN`
* **Request Body**:
```json
{
  "reason": "Customer cancelled due to out-of-town travel."
}
```
