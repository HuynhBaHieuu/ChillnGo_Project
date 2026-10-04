/// Roles and admin modules as the UI sees them (web/src/lib/roles.ts). The API
/// enforces access; this only decides which screens and buttons to show.
library;

import '../data/models.dart';

const adminModules = ['users', 'content', 'reports', 'categories', 'stats'];

const roleLabels = {'user': 'Người dùng', 'admin': 'Admin', 'superadmin': 'Super Admin'};

const moduleLabels = {
  'users': ('Người dùng', 'Khoá, mở khoá và đặt lại mật khẩu cho người dùng thường'),
  'content': ('Kiểm duyệt nội dung', 'Duyệt, ẩn, xoá bài đăng, lịch trình và bình luận'),
  'reports': ('Báo cáo vi phạm', 'Xử lý báo cáo spam và nội dung không phù hợp'),
  'categories': ('Danh mục', 'Quản lý địa điểm và tag'),
  'stats': ('Thống kê', 'Xem số liệu người dùng trong phạm vi được cấp'),
};

bool isStaff(User? user) => user?.role == 'admin' || user?.role == 'superadmin';

bool isSuperAdmin(User? user) => user?.role == 'superadmin';

bool hasModule(User? user, String module) {
  if (user?.role == 'superadmin') return true;
  return user?.role == 'admin' && (user?.permissions ?? const []).contains(module);
}

/// Where to go after signing in.
String homePathFor(User user) => isStaff(user) ? '/admin' : '/feed';
