# Sơ đồ luồng ứng dụng (App Flow Diagram)

Tổng hợp toàn bộ điều hướng giữa các trang ở frontend (`fe-ecomerce-shop/src/app`).
Nguồn dữ liệu: thẻ `<Link href=...>`, `router.push/replace(...)` và `src/middleware.ts`.

> Quy ước: viền liền = `<Link>` tĩnh • viền nét đứt = `router.push` trong code • mũi tên có nhãn = điều kiện / query string • cụm "Middleware" = redirect tự động theo role.

## 1. Toàn cảnh — phân vùng theo role

```mermaid
flowchart LR
    subgraph PUB["🌐 Public / Storefront"]
        ROOT["/ (root page)"]
        HOME["/homepage"]
        SEARCH["/search"]
        PRODUCT["/product/[id]"]
    end

    subgraph AUTH["🔑 Auth"]
        LOGIN["/auth/login"]
        SIGNUP["/auth/signup"]
        VERIFY["/auth/verify/[id]"]
        FORGOT["/auth/forgot-password"]
        CHGPW["/auth/change-password"]
    end

    subgraph USER["👤 User (đã đăng nhập)"]
        CART["/cart"]
        CHECKOUT["/checkout"]
        VNPAY["/checkout/vnpay-return"]
        PROFILE["/profile"]
        NOTI["/profile/notifications"]
        ORDERS["/profile/orders"]
        ORDER_ID["/profile/orders/[id]"]
        VOUCH["/profile/vouchers"]
    end

    subgraph ADMIN["🛠️ Admin"]
        A_HOME["/admin"]
        A_ORDERS["/admin/orders"]
        A_USERS["/admin/users"]
        A_CATS["/admin/categories"]
        A_CHAT["/admin/chat"]
        A_COUP["/admin/coupons"]
        A_PLIST["/admin/products/list"]
        A_PADD["/admin/products/add"]
        A_PEDIT["/admin/products/edit/[id]"]
        A_PREV["/admin/products/reviews"]
        A_PMEDIA["/admin/products/media"]
        A_AUTH["/admin/authority"]
        A_BRANDS["/admin/brands"]
        A_ROLES["/admin/roles"]
        A_SHOP["/admin/shop"]
        A_TX["/admin/transactions"]
        A_PROF["/admin/profile"]
    end

    subgraph STAFF["🧑‍💼 Staff / Operator"]
        S_HOME["/staff"]
        S_ORDERS["/staff/orders"]
        S_USERS["/staff/users"]
        S_CATS["/staff/categories"]
        S_CHAT["/staff/chat"]
        S_COUP["/staff/coupons"]
        S_PLIST["/staff/products/list"]
        S_PREV["/staff/products/reviews"]
        S_PROF["/staff/profile"]
    end

    MW{{"middleware.ts<br/>role gate"}}

    %% Middleware redirects
    MW -- "no session & non-public" --> LOGIN
    MW -- "session on /auth + ADMIN" --> A_HOME
    MW -- "session on /auth + OPERATOR" --> S_HOME
    MW -- "session on /auth + user (callbackUrl?)" --> HOME
    MW -- "ADMIN ngoài /admin" --> A_HOME
    MW -- "OPERATOR ngoài /staff" --> S_HOME
    MW -- "user vào /admin hoặc /staff" --> HOME

    %% Public navigation (Navbar / Footer)
    HOME --> SEARCH
    HOME --> PRODUCT
    SEARCH --> PRODUCT
    PRODUCT -.->|Add to cart| CART
    PRODUCT -.->|Mua ngay ?buyNow=1| CHECKOUT

    %% Auth flow
    LOGIN --> SIGNUP
    LOGIN --> FORGOT
    SIGNUP -.->|sau khi đăng ký| VERIFY
    VERIFY -.->|đã verify| LOGIN
    FORGOT --> LOGIN
    FORGOT -.->|gửi OTP ok| CHGPW
    CHGPW -.->|đổi xong| LOGIN
    LOGIN -.->|đăng nhập ok| HOME

    %% Cart / Checkout
    CART -.->|Thanh toán ?items=| CHECKOUT
    CART --> HOME
    CHECKOUT --> CART
    CHECKOUT -.->|chưa login| LOGIN
    CHECKOUT -.->|đặt hàng xong| ORDER_ID
    CHECKOUT -.->|VNPay callback| VNPAY
    VNPAY --> HOME
    VNPAY --> CART

    %% Profile menu (Navbar dropdown)
    HOME --> PROFILE
    PROFILE --> NOTI
    PROFILE --> ORDERS
    PROFILE --> VOUCH
    ORDERS --> ORDER_ID
    ORDER_ID -.->|Mua lại| CART
    ORDER_ID -.->|Đánh giá| PRODUCT
    VOUCH -.->|"Dùng ngay"| SEARCH
    NOTI -.->|click thông báo| ORDER_ID

    %% Admin sidebar
    A_HOME --> A_ORDERS
    A_HOME --> A_USERS
    A_HOME --> A_CATS
    A_HOME --> A_CHAT
    A_HOME --> A_COUP
    A_HOME --> A_PLIST
    A_PLIST --> A_PADD
    A_PLIST --> A_PEDIT
    A_PADD -.->|tạo xong| A_PEDIT
    A_PEDIT --> A_PLIST
    A_HOME --> A_PREV
    A_HOME --> A_PMEDIA
    A_HOME --> A_AUTH
    A_HOME --> A_BRANDS
    A_HOME --> A_ROLES
    A_HOME --> A_SHOP
    A_HOME --> A_TX
    A_HOME --> A_PROF
    A_USERS -.->|nhắn KH| A_CHAT
    A_CATS -.->|xem SP của danh mục| A_PLIST

    %% Staff sidebar
    S_HOME --> S_ORDERS
    S_HOME --> S_USERS
    S_HOME --> S_CATS
    S_HOME --> S_CHAT
    S_HOME --> S_COUP
    S_HOME --> S_PLIST
    S_HOME --> S_PREV
    S_HOME --> S_PROF

    %% Entry point
    ROOT --> HOME
    ROOT -. middleware .-> MW
```

## 2. Luồng Auth (chi tiết)

```mermaid
flowchart LR
    Guest((Khách)) --> LOGIN["/auth/login"]
    LOGIN -- "Chưa có TK" --> SIGNUP["/auth/signup"]
    LOGIN -- "Quên mật khẩu" --> FORGOT["/auth/forgot-password"]
    SIGNUP -- "submit ok" --> VERIFY["/auth/verify/[id]"]
    VERIFY -- "verify ok" --> LOGIN
    FORGOT -- "nhập email" --> CHGPW["/auth/change-password?email=..."]
    CHGPW -- "đặt lại MK" --> LOGIN
    LOGIN -- "ADMIN" --> ADMIN_HOME["/admin"]
    LOGIN -- "OPERATOR" --> STAFF_HOME["/staff"]
    LOGIN -- "USER (callbackUrl? hoặc mặc định)" --> HOME["/homepage"]
```

## 3. Luồng mua hàng (Storefront → Order)

```mermaid
flowchart LR
    HOME["/homepage"] --> SEARCH["/search<br/>?q= ?categoryId="]
    SEARCH --> PRODUCT["/product/[id]"]
    HOME --> PRODUCT
    PRODUCT -- "Thêm vào giỏ" --> CART["/cart"]
    PRODUCT -- "Mua ngay" --> CHECKOUT["/checkout?buyNow=1"]
    CART -- "Thanh toán items đã chọn" --> CHECKOUT2["/checkout?items=..."]
    CHECKOUT2 -- "chưa đăng nhập" --> LOGIN["/auth/login?callbackUrl=/checkout..."]
    CHECKOUT2 -- "VNPay" --> VNPAY["/checkout/vnpay-return"]
    CHECKOUT2 -- "COD/đặt ok" --> ORDER_ID["/profile/orders/[id]"]
    VNPAY -- "thành công" --> ORDER_ID
    VNPAY -- "thất bại" --> CART
    ORDER_ID -- "Mua lại" --> CART
    ORDER_ID -- "Đánh giá SP" --> PRODUCT
```

## 4. Bảng route đầy đủ

| Vùng | Route | Ghi chú |
|---|---|---|
| Public | `/`, `/homepage`, `/search`, `/product/[id]` | middleware coi là public |
| Auth | `/auth/login`, `/auth/signup`, `/auth/verify/[id]`, `/auth/forgot-password`, `/auth/change-password` | đã login sẽ bị redirect khỏi đây |
| User | `/cart`, `/checkout`, `/checkout/vnpay-return`, `/profile`, `/profile/notifications`, `/profile/orders`, `/profile/orders/[id]`, `/profile/vouchers` | yêu cầu session |
| Admin | `/admin`, `/admin/orders`, `/admin/users`, `/admin/categories`, `/admin/chat`, `/admin/coupons`, `/admin/products/{list,add,edit/[id],reviews,media}`, `/admin/authority`, `/admin/brands`, `/admin/roles`, `/admin/shop`, `/admin/transactions`, `/admin/profile` | role `ADMIN` |
| Staff | `/staff`, `/staff/orders`, `/staff/users`, `/staff/categories`, `/staff/chat`, `/staff/coupons`, `/staff/products/{list,reviews}`, `/staff/profile` | role `OPERATOR` |

## 5. Nguồn điều hướng chính

- **Navbar** (`components/header/Navbar.tsx`) — links tới `/homepage`, `/search`, `/search?categoryId=`, `/profile*`, `/auth/login`, `/auth/signup`
- **Admin sidebar** (`app/admin/sidebar.tsx`) — toàn bộ mục admin
- **Staff sidebar** (`app/staff/sidebar.tsx`) — toàn bộ mục staff
- **ProductCard** (`components/product/ProductCard.tsx`) → `/product/[id]`
- **ProductInfo** (`components/product/ProductInfo.tsx`) → `/cart`, `/checkout?buyNow=1`
- **Cart page** → `/checkout?items=...`
- **Checkout page** → `/auth/login?callbackUrl=`, `/profile/orders/[id]`, `/cart`
- **VNPay return** → `/homepage`, `/cart`
- **OrdersContent / BuyAgainButton / ReviewOrderDialog** → `/profile/orders/[id]`, `/cart`, `/product/[id]#reviews`
- **CategoriesClient** (admin) → `/admin/products/list?categoryId=`
- **AdminUsersClient** → `/admin/chat?room=`
- **middleware.ts** — gate role: thực hiện hầu hết redirect cross-area
