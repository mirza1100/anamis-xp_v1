# Anamis-XP VPN Panel API Documentation

## مقدمه / Introduction

این مستندات API برای پنل مدیریتی VPN آنامیس-ایکس‌پی است که تمام endpoint های موجود را توضیح می‌دهد.

This API documentation covers all available endpoints for the Anamis-XP VPN Management Panel.

## احراز هویت / Authentication

تمام API ها نیاز به احراز هویت JWT دارند. توکن باید در header `Authorization` با فرمت `Bearer <token>` ارسال شود.

All APIs require JWT authentication. The token must be sent in the `Authorization` header with format `Bearer <token>`.

### مثال / Example
```bash
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     -H "Content-Type: application/json" \
     http://localhost:3000/api/dashboard
```

## Endpoints

### 1. احراز هویت / Authentication

#### POST /api/login
ورود به سیستم / Login to system

**Request Body:**
```json
{
  "username": "admin",
  "password": "admin123"
}
```

**Response:**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "username": "admin",
    "role": "admin"
  },
  "config": {
    "language": "en",
    "theme": "light"
  }
}
```

### 2. داشبورد / Dashboard

#### GET /api/dashboard
دریافت اطلاعات داشبورد / Get dashboard information

**Response:**
```json
{
  "system": {
    "cpu": {
      "usage": 25,
      "cores": 4
    },
    "memory": {
      "usage": 60,
      "total": 8,
      "used": 4.8
    },
    "network": {
      "ipv4": "192.168.1.100",
      "ipv6": "2001:db8::1"
    }
  },
  "vpn": {
    "status": {
      "xray": true,
      "openvpn": false,
      "wireguard": true
    },
    "users": {
      "connected": 15,
      "total": 150
    }
  },
  "uptime": 86400
}
```

### 3. ورودی‌ها / Inbounds

#### GET /api/inbounds
دریافت لیست ورودی‌ها / Get list of inbounds

**Response:**
```json
[
  {
    "id": 1,
    "remark": "HTTP Inbound",
    "protocol": "http",
    "port": 8080,
    "listen": "0.0.0.0",
    "clients": [
      {
        "id": 1,
        "name": "User1",
        "email": "user1@example.com",
        "traffic": 1024000
      }
    ]
  }
]
```

### 4. تانل‌ها / Tunnels

#### GET /api/tunnels
دریافت لیست تانل‌ها / Get list of tunnels

**Response:**
```json
[
  {
    "id": 1,
    "name": "Gaming Tunnel",
    "type": "gaming",
    "source": "192.168.1.100",
    "destination": "10.0.0.1",
    "port": 8080,
    "status": "active",
    "ping": 15
  }
]
```

### 5. تنظیمات / Settings

#### GET /api/settings
دریافت تنظیمات پنل / Get panel settings

**Response:**
```json
{
  "panel": {
    "port": 3000,
    "username": "admin",
    "language": "en",
    "theme": "light"
  },
  "vpn": {
    "xray": {
      "enabled": true,
      "port": 443
    },
    "openvpn": {
      "enabled": true,
      "port": 1194
    }
  }
}
```

#### POST /api/settings
به‌روزرسانی تنظیمات پنل / Update panel settings

**Request Body:**
```json
{
  "panel": {
    "username": "newadmin",
    "port": 3001,
    "language": "fa",
    "theme": "dark"
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Settings updated successfully"
}
```

### 6. مدیریت هسته‌های VPN / VPN Core Management

#### GET /api/cores/status
دریافت وضعیت تمام هسته‌های VPN / Get status of all VPN cores

**Response:**
```json
{
  "xray": true,
  "openvpn": false,
  "wireguard": true
}
```

#### POST /api/cores/:core/start
راه‌اندازی هسته VPN / Start VPN core

**Parameters:**
- `core`: نام هسته (xray, openvpn, wireguard)

**Response:**
```json
{
  "success": true,
  "message": "xray started successfully"
}
```

#### POST /api/cores/:core/stop
توقف هسته VPN / Stop VPN core

**Parameters:**
- `core`: نام هسته (xray, openvpn, wireguard)

**Response:**
```json
{
  "success": true,
  "message": "xray stopped successfully"
}
```

#### POST /api/cores/:core/restart
راه‌اندازی مجدد هسته VPN / Restart VPN core

**Parameters:**
- `core`: نام هسته (xray, openvpn, wireguard)

**Response:**
```json
{
  "success": true,
  "message": "xray restarted successfully"
}
```

#### GET /api/cores/:core/logs
دریافت لاگ‌های هسته VPN / Get VPN core logs

**Parameters:**
- `core`: نام هسته (xray, openvpn, wireguard)
- `lines`: تعداد خطوط (اختیاری، پیش‌فرض: 100)

**Response:**
```json
{
  "logs": [
    "2024-01-01 12:00:00 [INFO] Xray started",
    "2024-01-01 12:00:01 [INFO] Listening on port 443"
  ]
}
```

### 7. مدیریت کاربران VPN / VPN User Management

#### GET /api/users/:core
لیست کاربران هر پروتکل (Xray, OpenVPN, WireGuard, SSH)

- `core`: یکی از مقادیر `xray`, `openvpn`, `wireguard`, `ssh`

**Response Example (Xray):**
```json
{
  "users": [
    { "username": "b831381d-6324-4d53-ad4f-8cda48b30811", "id": "b831381d-6324-4d53-ad4f-8cda48b30811", "alterId": 0, "security": "auto" }
  ]
}
```

**Response Example (WireGuard):**
```json
{
  "users": [
    { "username": "CLIENT1_PUBLIC_KEY_HERE", "publicKey": "CLIENT1_PUBLIC_KEY_HERE", "allowedIPs": "10.0.2.2/32" }
  ]
}
```

**Response Example (OpenVPN):**
```json
{
  "users": [
    { "username": "client1" },
    { "username": "client2" }
  ]
}
```

**Response Example (SSH):**
```json
{
  "users": [
    { "username": "vpn_user1" },
    { "username": "vpn_user2" }
  ]
}
```

---

#### POST /api/users/:core
افزودن کاربر جدید به پروتکل موردنظر

- `core`: یکی از مقادیر `xray`, `wireguard`, `ssh` (OpenVPN: Not implemented)

**Request Example (Xray):**
```json
{
  "id": "NEW-UUID-HERE",
  "alterId": 0,
  "security": "auto"
}
```

**Request Example (WireGuard):**
```json
{
  "publicKey": "CLIENT_PUBLIC_KEY_HERE",
  "allowedIPs": "10.0.2.4/32"
}
```

**Request Example (SSH):**
```json
{
  "username": "vpn_newuser",
  "password": "securepassword"
}
```

**Response:**
```json
{ "success": true }
```

---

#### DELETE /api/users/:core/:username
حذف کاربر از پروتکل موردنظر

- `core`: یکی از مقادیر `xray`, `wireguard`, `ssh` (OpenVPN: Not implemented)
- `username`: شناسه کاربر (برای Xray: UUID، WireGuard: PublicKey، SSH: نام کاربری)

**Response:**
```json
{ "success": true }
```

---

#### POST /api/users/:core/:username/reset
ریست رمز عبور کاربر (فقط SSH، سایر پروتکل‌ها: Not implemented)

- `core`: فقط `ssh`
- `username`: نام کاربری

**Request:**
```json
{ "password": "newpassword" }
```

**Response:**
```json
{ "success": true }
```

---

**توضیحات پروتکل‌ها / Protocol Notes:**
- Xray: کاربران با UUID (id) مدیریت می‌شوند. افزودن/حذف کاربر، کانفیگ را ویرایش و سرویس را ریستارت می‌کند.
- WireGuard: کاربران با PublicKey مدیریت می‌شوند. افزودن/حذف کاربر، [Peer] را به کانفیگ اضافه/حذف و سرویس را ریستارت می‌کند.
- OpenVPN: فقط لیست کاربران متصل از status.log خوانده می‌شود. افزودن/حذف کاربر نیازمند مدیریت گواهی و اسکریپت اختصاصی است.
- SSH: فقط کاربران با پیشوند vpn_ مدیریت می‌شوند. افزودن/حذف کاربر با useradd/userdel انجام می‌شود.

### 7. لاگ‌ها / Logs

#### GET /api/logs
دریافت لاگ‌های پنل / Get panel logs

**Response:**
```json
{
  "logs": [
    "2024-01-01 12:00:00 [INFO] Panel started",
    "2024-01-01 12:00:01 [INFO] User admin logged in"
  ]
}
```

## کدهای خطا / Error Codes

### 400 Bad Request
درخواست نامعتبر / Invalid request

### 401 Unauthorized
عدم احراز هویت / Unauthorized

### 403 Forbidden
عدم دسترسی / Forbidden

### 404 Not Found
منبع یافت نشد / Resource not found

### 500 Internal Server Error
خطای داخلی سرور / Internal server error

## مثال‌های استفاده / Usage Examples

### ورود به سیستم / Login
```bash
curl -X POST http://localhost:3000/api/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "admin123"}'
```

### دریافت داشبورد / Get Dashboard
```bash
curl -X GET http://localhost:3000/api/dashboard \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### راه‌اندازی Xray / Start Xray
```bash
curl -X POST http://localhost:3000/api/cores/xray/start \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### دریافت لاگ‌های OpenVPN / Get OpenVPN Logs
```bash
curl -X GET "http://localhost:3000/api/cores/openvpn/logs?lines=50" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## نکات مهم / Important Notes

1. تمام درخواست‌ها باید با Content-Type: application/json ارسال شوند
2. توکن JWT پس از 24 ساعت منقضی می‌شود
3. در صورت خطا، پیام خطا در فیلد error پاسخ قرار می‌گیرد
4. تمام زمان‌ها در فرمت ISO 8601 ارسال می‌شوند

## پشتیبانی / Support

برای سوالات و مشکلات مربوط به API، لطفاً با تیم پشتیبانی تماس بگیرید.

For API-related questions and issues, please contact the support team.