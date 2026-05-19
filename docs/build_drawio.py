"""
Generate a draw.io (.drawio) file of the app-flow diagram.

Each node is a group (card + stripe + text), and every edge uses
source/target IDs so the connectors re-route themselves whenever you
drag the nodes around in draw.io.

Open the output via the desktop app (drawio.exe) or app.diagrams.net.

Run:
    python build_drawio.py
"""

import os
import xml.etree.ElementTree as ET


# ---------- palette ----------
BG_COLOR        = "#EFEAE2"
NODE_BG         = "#FFFFFF"
NODE_BD         = "#C9C2B5"
TITLE_COLOR     = "#1A1A1A"
ROUTE_COLOR     = "#6A6A6A"
ARROW_COLOR     = "#2F2F2F"
ARROW_SOFT      = "#6B6B6B"
LABEL_BG_COLOR  = "#FFFFFF"
LABEL_BD_COLOR  = "#C9C2B5"

STRIPE = {
    "store": "#2C5F5D",
    "user":  "#574A75",
    "auth":  "#B05538",
    "admin": "#7E3140",
    "staff": "#3F6B4E",
}
PANEL = {
    "store": "#D6CFB8",
    "user":  "#CFC8D6",
    "auth":  "#D8C8BC",
    "admin": "#D2C2C8",
    "staff": "#C8D4C8",
}


# ---------- id & root setup ----------
_id_counter = [10]
ROOT = None  # set in main()


def new_id():
    _id_counter[0] += 1
    return f"c{_id_counter[0]}"


def add_geom(cell, x, y, w, h, relative=False):
    g = ET.SubElement(cell, "mxGeometry",
                      x=str(x), y=str(y),
                      width=str(w), height=str(h))
    if relative:
        g.set("relative", "1")
    g.set("as", "geometry")
    return g


def add_vertex(parent_id, x, y, w, h, value="", style="", _id=None,
               connectable=True):
    if _id is None:
        _id = new_id()
    attrs = dict(id=_id, value=value, style=style,
                 vertex="1", parent=parent_id)
    if not connectable:
        attrs["connectable"] = "0"
    cell = ET.SubElement(ROOT, "mxCell", **attrs)
    add_geom(cell, x, y, w, h)
    return _id


def add_group_cell(parent_id, x, y, w, h):
    _id = new_id()
    cell = ET.SubElement(ROOT, "mxCell",
                         id=_id, value="",
                         style="group",
                         vertex="1", connectable="1",
                         parent=parent_id)
    add_geom(cell, x, y, w, h)
    return _id


# ---------- node = grouped card + stripe + text ----------
def add_node(x, y, w, h, title, route, stripe_key, dashed=False):
    gid = add_group_cell("1", x, y, w, h)

    card_style = (
        f"rounded=0;whiteSpace=wrap;html=1;"
        f"fillColor={NODE_BG};strokeColor={NODE_BD};strokeWidth=1;"
    )
    if dashed:
        card_style += "dashed=1;dashPattern=4 4;"
    add_vertex(gid, 0, 0, w, h, "", card_style, connectable=False)

    stripe_style = (
        f"rounded=0;whiteSpace=wrap;html=1;"
        f"fillColor={STRIPE[stripe_key]};strokeColor=none;"
    )
    add_vertex(gid, 0, 0, 6, h, "", stripe_style, connectable=False)

    label_html = (
        f"<b>{title}</b><br>"
        f'<span style="font-family:Consolas,monospace;'
        f'color:{ROUTE_COLOR};font-size:10px;">{route}</span>'
    )
    text_style = (
        "text;html=1;strokeColor=none;fillColor=none;"
        "align=left;verticalAlign=top;whiteSpace=wrap;rounded=0;"
        f"fontSize=12;fontColor={TITLE_COLOR};"
    )
    add_vertex(gid, 14, 6, w - 16, h - 12, label_html, text_style,
               connectable=False)

    return gid


# ---------- panel = decorative background swim-lane ----------
def add_panel(x, y, w, h, fill, label):
    add_vertex("1", x, y, w, h, "",
        f"rounded=0;whiteSpace=wrap;html=1;"
        f"fillColor={fill};strokeColor=none;fillOpacity=55;",
        connectable=False)
    add_vertex("1", x + 16, y + 6, w - 32, 20, label,
        "text;html=1;strokeColor=none;fillColor=none;"
        "align=left;verticalAlign=top;fontStyle=1;fontSize=10;"
        "fontColor=#3A3A3A;letterSpacing=2;",
        connectable=False)


# ---------- edge with source/target ----------
def add_edge(src_id, tgt_id, label="", *,
             dashed=False, soft=False,
             exit_xy=None, entry_xy=None,
             waypoints=None):
    color = ARROW_SOFT if soft else ARROW_COLOR
    width = 1 if soft else 1.5

    parts = [
        "html=1", "rounded=0",
        f"strokeColor={color}", f"strokeWidth={width}",
        "endArrow=classic", "endFill=1", "startArrow=none",
        "edgeStyle=orthogonalEdgeStyle",
        "fontSize=10", "fontStyle=2", f"fontColor={TITLE_COLOR}",
        f"labelBackgroundColor={LABEL_BG_COLOR}",
        f"labelBorderColor={LABEL_BD_COLOR}",
    ]
    if dashed:
        parts += ["dashed=1", "dashPattern=5 4"]
    if exit_xy is not None:
        parts += [f"exitX={exit_xy[0]}", f"exitY={exit_xy[1]}",
                  "exitDx=0", "exitDy=0"]
    if entry_xy is not None:
        parts += [f"entryX={entry_xy[0]}", f"entryY={entry_xy[1]}",
                  "entryDx=0", "entryDy=0"]
    style = ";".join(parts) + ";"

    _id = new_id()
    cell = ET.SubElement(ROOT, "mxCell",
                         id=_id, value=label, style=style,
                         edge="1", parent="1",
                         source=src_id, target=tgt_id)
    geom = ET.SubElement(cell, "mxGeometry", relative="1")
    geom.set("as", "geometry")
    if waypoints:
        arr = ET.SubElement(geom, "Array")
        arr.set("as", "points")
        for px, py in waypoints:
            ET.SubElement(arr, "mxPoint", x=str(px), y=str(py))
    return _id


# ---------- build ----------
def main():
    global ROOT

    mxfile = ET.Element("mxfile",
                        host="app.diagrams.net",
                        agent="build_drawio.py",
                        version="24.0.0")
    diagram = ET.SubElement(mxfile, "diagram",
                            name="App Flow", id="page1")
    model = ET.SubElement(diagram, "mxGraphModel",
        dx="2400", dy="1500", grid="1", gridSize="10",
        guides="1", tooltips="1", connect="1", arrows="1",
        fold="1", page="1", pageScale="1",
        pageWidth="1920", pageHeight="1140",
        math="0", shadow="0", background=BG_COLOR)
    ROOT = ET.SubElement(model, "root")
    ET.SubElement(ROOT, "mxCell", id="0")
    ET.SubElement(ROOT, "mxCell", id="1", parent="0")

    # Title
    add_vertex("1", 32, 20, 1500, 32,
        "Sơ đồ luồng ứng dụng — e-commerce shop",
        "text;html=1;strokeColor=none;fillColor=none;align=left;"
        "verticalAlign=top;fontStyle=1;fontSize=18;fontColor=#1A1A1A;",
        connectable=False)
    add_vertex("1", 32, 58, 1800, 20,
        "Mỗi mũi tên là một hành động hoặc điều kiện chuyển trang · "
        "26 trang ứng dụng + middleware phân quyền",
        "text;html=1;strokeColor=none;fillColor=none;align=left;"
        "verticalAlign=top;fontSize=10;fontColor=#555555;",
        connectable=False)

    # Panels
    add_panel(  16,  92, 1888, 218, PANEL["store"], "CỬA HÀNG &amp; MUA HÀNG")
    add_panel(  16, 324, 1888, 118, PANEL["user"],  "TÀI KHOẢN NGƯỜI DÙNG")
    add_panel(  16, 456, 1888, 138, PANEL["auth"],  "XÁC THỰC")
    add_panel(  16, 608, 1296, 456, PANEL["admin"], "QUẢN TRỊ — ADMIN · /admin/*")
    add_panel(1324, 608,  580, 456, PANEL["staff"], "NHÂN VIÊN — STAFF · /staff/*")

    # ===== Nodes =====
    n = {}

    # Storefront
    n['home']        = add_node( 40, 150, 200, 62, "Trang chủ",          "/homepage", "store")
    n['search']      = add_node(290, 150, 200, 62, "Tìm kiếm",           "/search", "store")
    n['product']     = add_node(540, 150, 200, 62, "Chi tiết sản phẩm",  "/product/[id]", "store")
    n['cart']        = add_node(790, 150, 200, 62, "Giỏ hàng",           "/cart", "store")
    n['checkout']    = add_node(1040, 150, 200, 62, "Thanh toán",        "/checkout", "store")
    n['orderDetail'] = add_node(1290, 150, 280, 62, "Chi tiết đơn hàng", "/profile/orders/[id]", "store")
    n['vnpay']       = add_node(1040, 238, 240, 62, "Trả về VNPay",      "/checkout/vnpay-return", "store")

    # User account
    n['profile']  = add_node( 40, 360, 200, 62, "Hồ sơ",          "/profile", "user")
    n['notif']    = add_node(290, 360, 200, 62, "Thông báo",      "/profile/notifications", "user")
    n['orders']   = add_node(540, 360, 200, 62, "Danh sách đơn",  "/profile/orders", "user")
    n['vouchers'] = add_node(790, 360, 200, 62, "Voucher của tôi","/profile/vouchers", "user")

    # Auth
    n['login']  = add_node(  40, 500, 200, 62, "Đăng nhập",         "/auth/login", "auth")
    n['signup'] = add_node( 290, 500, 200, 62, "Đăng ký",           "/auth/signup", "auth")
    n['verify'] = add_node( 540, 500, 200, 62, "Xác thực tài khoản","/auth/verify/[id]", "auth")
    n['forgot'] = add_node( 790, 500, 200, 62, "Quên mật khẩu",     "/auth/forgot-password", "auth")
    n['chgpw']  = add_node(1040, 500, 200, 62, "Đổi mật khẩu",      "/auth/change-password", "auth")

    # Admin — chỉ những route THẬT SỰ có sidebar entry hoặc reachable từ flow.
    # 9 mục sidebar + /admin/profile (mở qua avatar trong sidebar header/footer).
    admin = [
        # Hàng 1 — sidebar chính
        ('adminHome',    40, 700, "Bảng điều khiển", "/admin"),
        ('adminOrders', 290, 700, "Quản lý đơn hàng","/admin/orders"),
        ('adminUsers',  540, 700, "Khách hàng",      "/admin/users"),
        ('adminCats',   790, 700, "Danh mục",        "/admin/categories"),
        ('adminChat',  1040, 700, "Chat",            "/admin/chat"),
        # Hàng 2 — sidebar còn lại + avatar
        ('adminCoupons', 40, 820, "Voucher",         "/admin/coupons"),
        ('adminPlist',  290, 820, "Danh sách sản phẩm", "/admin/products/list"),
        ('adminPrev',   540, 820, "Review sản phẩm", "/admin/products/reviews"),
        ('adminAuth',   790, 820, "Cài đặt Quyền",   "/admin/authority"),
        ('adminProf',  1040, 820, "Hồ sơ admin",     "/admin/profile"),
    ]
    for key, x, y, t, r in admin:
        n[key] = add_node(x, y, 200, 62, t, r, "admin")

    # Staff — 7 mục sidebar + /staff/profile (qua avatar).
    # KHÔNG có node /staff vì file page.tsx chỉ redirect("/staff/orders").
    staff = [
        # Hàng 1
        ('staffOrders', 1340, 700, "Quản lý đơn hàng","/staff/orders"),
        ('staffUsers',  1530, 700, "Khách hàng",      "/staff/users"),
        ('staffCats',   1720, 700, "Danh mục",        "/staff/categories"),
        # Hàng 2
        ('staffChat',   1340, 800, "Chat",            "/staff/chat"),
        ('staffCoupons',1530, 800, "Voucher",         "/staff/coupons"),
        ('staffPlist',  1720, 800, "Danh sách sản phẩm", "/staff/products/list"),
        # Hàng 3
        ('staffPrev',   1340, 900, "Review sản phẩm", "/staff/products/reviews"),
        ('staffProf',   1530, 900, "Hồ sơ staff",     "/staff/profile"),
    ]
    for key, x, y, t, r in staff:
        n[key] = add_node(x, y, 180, 62, t, r, "staff")

    # ===== Edges =====

    # Storefront flow
    add_edge(n['home'],     n['search'],   "tìm kiếm",         exit_xy=(1, 0.5), entry_xy=(0, 0.5))
    add_edge(n['search'],   n['product'],  "chọn SP",          exit_xy=(1, 0.5), entry_xy=(0, 0.5))
    add_edge(n['product'],  n['cart'],     "thêm vào giỏ",     exit_xy=(1, 0.5), entry_xy=(0, 0.5))
    add_edge(n['cart'],     n['checkout'], "thanh toán",       exit_xy=(1, 0.5), entry_xy=(0, 0.5))
    add_edge(n['checkout'], n['orderDetail'], "đặt thành công",exit_xy=(1, 0.5), entry_xy=(0, 0.5))

    # Mua ngay — curve over the top
    add_edge(n['product'], n['checkout'], 'người dùng nhấn "Mua ngay"',
             exit_xy=(0.5, 0), entry_xy=(0.5, 0),
             waypoints=[(640, 110), (1140, 110)])

    # Checkout ↔ VNPay
    add_edge(n['checkout'], n['vnpay'], "chọn VNPay",
             exit_xy=(0.5, 1), entry_xy=(0.5, 0))
    add_edge(n['vnpay'], n['orderDetail'], "thanh toán thành công",
             exit_xy=(1, 0.5), entry_xy=(0.5, 1),
             waypoints=[(1340, 269), (1340, 230)])
    add_edge(n['vnpay'], n['cart'], "thanh toán thất bại",
             exit_xy=(0, 0.5), entry_xy=(0.5, 1),
             waypoints=[(900, 269), (900, 230)])

    # Home → Profile
    add_edge(n['home'], n['profile'], 'nhấn avatar → "Thông tin cá nhân"',
             exit_xy=(0.5, 1), entry_xy=(0.5, 0))

    # Profile siblings (tabs)
    add_edge(n['profile'], n['notif'],    "",                      exit_xy=(1, 0.5), entry_xy=(0, 0.5))
    add_edge(n['profile'], n['orders'],   "các tab trong /profile",exit_xy=(1, 0.5), entry_xy=(0, 0.5))
    add_edge(n['profile'], n['vouchers'], "",                      exit_xy=(1, 0.5), entry_xy=(0, 0.5))

    # Orders → Order detail
    add_edge(n['orders'], n['orderDetail'], "nhấn vào một đơn hàng",
             exit_xy=(0.5, 0), entry_xy=(0.5, 1))

    # Voucher → Search
    add_edge(n['vouchers'], n['search'], 'nhấn "Dùng ngay"',
             exit_xy=(0.5, 0), entry_xy=(0.5, 1))

    # Checkout → Login (dashed — chưa đăng nhập)
    add_edge(n['checkout'], n['login'], "người dùng chưa đăng nhập",
             dashed=True,
             exit_xy=(0.5, 1), entry_xy=(0.5, 0))

    # Auth flow
    add_edge(n['login'],  n['signup'], 'nhấn "Đăng ký"',         exit_xy=(1, 0.5), entry_xy=(0, 0.5))
    add_edge(n['signup'], n['verify'], "đăng ký thành công",     exit_xy=(1, 0.5), entry_xy=(0, 0.5))
    add_edge(n['verify'], n['login'],  "xác thực thành công",
             exit_xy=(0.5, 1), entry_xy=(0.5, 1))
    add_edge(n['login'],  n['forgot'], 'nhấn "Quên mật khẩu"',
             exit_xy=(0.5, 1), entry_xy=(0.5, 1))
    add_edge(n['forgot'], n['chgpw'],  "nhập email hợp lệ",      exit_xy=(1, 0.5), entry_xy=(0, 0.5))
    add_edge(n['chgpw'],  n['login'],  "đổi mật khẩu xong",
             exit_xy=(0.5, 1), entry_xy=(0.5, 1))

    # Login outcomes
    add_edge(n['login'], n['home'],      "đăng nhập (vai trò USER)",
             exit_xy=(0, 0.5), entry_xy=(0, 0.5))
    add_edge(n['login'], n['adminHome'], "có vai trò ADMIN",
             exit_xy=(0.5, 1), entry_xy=(0.5, 0))
    # /staff redirect → /staff/orders nên login OPERATOR thực chất tới /staff/orders
    add_edge(n['login'], n['staffOrders'],
             "có vai trò OPERATOR (/staff → /staff/orders)",
             exit_xy=(1, 0.5), entry_xy=(0.5, 0))

    # Admin internal — chỉ những điều hướng có thật trong code
    # CategoriesClient.tsx → router.push(`/admin/products/list?categoryId=...`)
    add_edge(n['adminCats'],  n['adminPlist'],
             'nhấn "Xem SP của danh mục"',
             soft=True, exit_xy=(0.5, 1), entry_xy=(0.5, 0))
    # AdminUsersClient.tsx → router.push(`/admin/chat?room=...`)
    add_edge(n['adminUsers'], n['adminChat'],
             'nhấn "Nhắn KH" → chat',
             soft=True, exit_xy=(1, 0.5), entry_xy=(0, 0.5))
    # /admin (Dashboard) → /admin/profile qua avatar trong sidebar
    add_edge(n['adminHome'], n['adminProf'],
             "nhấn avatar trong sidebar",
             soft=True, exit_xy=(0.5, 1), entry_xy=(0.5, 0))

    # Staff internal — /staff/orders → /staff/profile qua avatar
    add_edge(n['staffOrders'], n['staffProf'],
             "nhấn avatar trong sidebar",
             soft=True, exit_xy=(0.5, 1), entry_xy=(0.5, 1))

    # ===== LEGEND (bottom strip, ngoài panels) =====
    LY = 1085
    # Label "Chú giải:"
    add_vertex("1", 32, LY, 100, 22, "Chú giải:",
        "text;html=1;strokeColor=none;fillColor=none;align=left;"
        "verticalAlign=middle;fontStyle=1;fontSize=11;fontColor=#3A3A3A;",
        connectable=False)

    # Color swatches cho 5 vùng
    swatches = [
        (120, "store", "Cửa hàng"),
        (240, "user",  "Tài khoản"),
        (360, "auth",  "Xác thực"),
        (470, "admin", "Quản trị Admin"),
        (610, "staff", "Nhân viên Staff"),
    ]
    for sx, key, label in swatches:
        add_vertex("1", sx, LY + 5, 14, 14, "",
            f"rounded=0;whiteSpace=wrap;html=1;"
            f"fillColor={STRIPE[key]};strokeColor=none;",
            connectable=False)
        add_vertex("1", sx + 20, LY, 110, 22, label,
            "text;html=1;strokeColor=none;fillColor=none;align=left;"
            "verticalAlign=middle;fontSize=10;fontColor=#3A3A3A;",
            connectable=False)

    # Sample edges: solid / soft / dashed
    def legend_edge(x0, y0, x1, y1, label_x, label_text, *, soft=False, dashed=False):
        color = ARROW_SOFT if soft else ARROW_COLOR
        width = 1 if soft else 1.5
        parts = [
            "html=1", "rounded=0",
            f"strokeColor={color}", f"strokeWidth={width}",
            "endArrow=classic", "endFill=1", "startArrow=none",
        ]
        if dashed:
            parts += ["dashed=1", "dashPattern=5 4"]
        style = ";".join(parts) + ";"
        _id = new_id()
        cell = ET.SubElement(ROOT, "mxCell",
                             id=_id, value="", style=style,
                             edge="1", parent="1")
        geom = ET.SubElement(cell, "mxGeometry", relative="1")
        geom.set("as", "geometry")
        src_pt = ET.SubElement(geom, "mxPoint", x=str(x0), y=str(y0))
        src_pt.set("as", "sourcePoint")
        tgt_pt = ET.SubElement(geom, "mxPoint", x=str(x1), y=str(y1))
        tgt_pt.set("as", "targetPoint")
        add_vertex("1", label_x, LY, 200, 22, label_text,
            "text;html=1;strokeColor=none;fillColor=none;align=left;"
            "verticalAlign=middle;fontSize=10;fontColor=#3A3A3A;",
            connectable=False)

    # Mẫu: điều hướng chính
    legend_edge(800,  LY + 12, 850,  LY + 12, 858,  "điều hướng chính (Link / router.push)")
    # Mẫu: điều hướng nội bộ
    legend_edge(1180, LY + 12, 1230, LY + 12, 1238, "điều hướng nội bộ", soft=True)
    # Mẫu: điều kiện / middleware
    legend_edge(1410, LY + 12, 1460, LY + 12, 1468, "điều kiện / middleware (dashed)", dashed=True)

    # ===== Save =====
    out = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                       "app-flow-diagram.drawio")
    tree = ET.ElementTree(mxfile)
    ET.indent(tree, space="  ", level=0)
    tree.write(out, encoding="utf-8", xml_declaration=True)
    print(f"OK -> {out}")


if __name__ == "__main__":
    main()
