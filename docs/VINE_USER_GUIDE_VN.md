VINE — Hướng dẫn sử dụng (Tiếng Việt)
=====================================

Mục đích
--------
Tài liệu này là hướng dẫn dành cho người dùng và quản trị viên của ứng dụng web VINE. Nó mô tả khái quát về các module, vai trò (roles), giao diện chính, và các ví dụ thao tác thường gặp như tạo/sửa/xóa task, chấm công (check-in/out), gửi/duyệt nghỉ phép, và đặt phòng họp.

Mục lục
-------
- Giới thiệu nhanh
- Vai trò trong hệ thống
- Các module chính và cách dùng
  - Dashboard
  - Tasks (Bảng công việc)
  - Attendance (Chấm công)
  - Organization (Quản lý người dùng & vai trò)
  - Leave (Nghỉ phép)
  - Meeting Rooms (Đặt phòng họp)
  - Notifications (Thông báo)
- Hướng dẫn thao tác: Tạo / Cập nhật / Xóa Task (ví dụ từng bước)
- Hướng dẫn chấm công: Check-in / Check-out và cài đặt On-time
- Mô tả các bảng chính trong database
- Lưu ý kỹ thuật & mẹo vận hành
- Câu hỏi thường gặp (FAQ)

Giới thiệu nhanh
-----------------
VINE là ứng dụng quản lý nhân sự nội bộ nhỏ gọn: hỗ trợ chấm công, quản lý nhiệm vụ (task board), duyệt nghỉ phép, và đặt phòng họp. Ứng dụng có giao diện web (React + TypeScript) và dùng Supabase (Postgres) cho backend/auth/realtime.

Vai trò trong hệ thống
----------------------
Hệ thống phân quyền theo vai trò cơ bản:
- Admin: Toàn quyền — quản lý người dùng, xem/duyệt mọi dữ liệu, cấu hình hệ thống.
- Leader: Quản lý team — duyệt nghỉ phép của team, xem báo cáo team, có thể là leader nhưng không có toàn quyền admin.
- Staff: Nhân viên bình thường — tạo task cho bản thân/nhóm, check-in/out, gửi yêu cầu nghỉ.

Các module chính và cách dùng
-----------------------------
Lưu ý: các tên component/pages sẽ xuất hiện tương ứng trong thanh điều hướng (ví dụ `Tasks`, `Attendance`, `Organization`, `Leave`, `Meeting Rooms`).

1) Dashboard
- Mục tiêu: tóm tắt nhanh thông tin cá nhân — today's tasks, latest notifications, tỉ lệ on-time, v.v.
- Dùng để nhanh chóng truy cập các hành động thường dùng.

2) Tasks (Bảng công việc)
- Màn hình: `Tasks` hiển thị một Kanban board (cột trạng thái) và danh sách các task.
- Cột mặc định: `To Do`, `In Progress`, `Review`, `Done`.
- Quyền:
  - Admin: xem và chỉnh sửa mọi task.
  - Leader/Staff: mặc định chỉ thấy task được giao (assignee = bạn) nhưng có thể đổi bộ lọc để xem task khác (nếu được phép).
- Thao tác chính:
  - Tạo Task: mở `Create Task` dialog → điền `title`, `description`, chọn `assignee` (bắt buộc), chọn `deadline` (bắt buộc), chọn priority/column nếu cần → Submit.
  - Cập nhật Task: click card → `Edit Task` dialog hiện sẵn dữ liệu → chỉnh sửa → Submit. Nếu bạn không phải assignee và không phải admin, hệ thống sẽ hiển thị cảnh báo ("Task này không phải của bạn") và ngăn một số thao tác theo chính sách UI.
  - Xóa Task: thực hiện từ menu card hoặc dialog (nếu có quyền) → Confirm.
  - Kéo thả: di chuyển card giữa các cột để thay đổi trạng thái (nếu UI cho phép).

3) Attendance (Chấm công)
- Màn hình: `Attendance` hoặc widget chấm công nơi người dùng check-in / check-out.
- Chấm công:
  - Check-in: bấm `Check In` để lưu 1 bản ghi chấm công (timestamptz). Có thể lưu location nếu browser cho phép.
  - Check-out: bấm `Check Out` để kết thúc.
- Cài đặt On-time (Admin): vào `Attendance Settings` (Organization → Attendance Settings) để thiết lập giờ `On-time` (ví dụ 09:00). Hệ thống so sánh giờ check-in với cutoff này để gắn nhãn `On-time` hoặc `Late`.
- Thống kê: widget tính tổng ngày công, giờ trung bình, và `On-time Rate` (tỷ lệ check-in đúng giờ) trên 12 tháng gần nhất.
- Lưu ý timezone: timestamp lưu dưới dạng `timestamptz`; UI chuyển sang giờ địa phương khi hiển thị, nên so sánh giờ cần làm cẩn trọng (hệ thống hiện tại so sánh giờ theo local client, có thể gây khác biệt nếu thiết lập server khác timezone).

4) Organization (Quản lý người dùng & vai trò)
- Màn hình `Organization` gồm các tab: `Users` (hoặc `User`), `Teams`, `Roles`, `Shifts`.
- Admin: thêm/sửa/xóa người dùng, gán role, quản lý team.
- `UserDirectory`: danh sách người dùng — xem chi tiết nhưng không chỉnh sửa từ đây (read-only view có thể từ một dialog `View Profile`).

5) Leave (Nghỉ phép)
- Màn hình `Leave`: gửi đơn nghỉ, xem lịch sử, leader duyệt.
- Gửi nghỉ: fill form với ngày bắt đầu/kết thúc, loại nghỉ, lý do → Submit.
- Duyệt (Leader): vào `LeaderLeaveApproval` để chấp nhận/không chấp nhận các yêu cầu của team.

6) Meeting Rooms (Đặt phòng họp)
- Calendar view + tạo booking dialog.
- Tạo booking: chọn phòng, thời gian, mô tả → hệ thống kiểm tra xung đột và lưu booking.

7) Notifications (Thông báo)
- Thông báo hiện trên `Notification Bell` ở header: task được giao, request được duyệt, v.v.
- Click sẽ mở chi tiết (nếu có link đến task/leave/...).

Hướng dẫn thao tác: Tạo / Cập nhật / Xóa Task (chi tiết ví dụ)
-----------------------------------------------------------
Ví dụ 1 — Tạo Task
- Bước 1: Mở trang `Tasks` → nhấn nút `Create Task`.
- Bước 2: Điền `Title` (ví dụ: "Chuẩn bị báo cáo tuần"), `Description` (nội dung), **Chọn Assignee** (bắt buộc), **Chọn Deadline** (bắt buộc). Có thể chọn `Priority` và `Column` nếu muốn.
- Bước 3: Nhấn `Create` → hệ thống gọi API supabase để insert vào bảng `tasks`.
- Sau khi tạo: hệ thống gửi thông báo cho assignee (nếu có) và board sẽ cập nhật via realtime.

Ví dụ 2 — Cập nhật Task
- Bước 1: Tìm card trên board hoặc từ danh sách, click để mở `Edit Task` dialog.
- Bước 2: Thay đổi trường mong muốn (title, assignee, deadline, completed date `completed_at` nếu task đã hoàn thành).
- Bước 3: Nhấn `Save`.
- Quyền: nếu bạn không phải `assignee` và không phải `admin`, một số cập nhật có thể bị chặn (UI sẽ hiển thị "Task này không phải của bạn"). Đây là kiểm soát ở client; để chặt chẽ hơn cần RLS server-side.

Ví dụ 3 — Xóa Task
- Bước 1: Mở task card → chọn `Delete` hoặc menu hành động.
- Bước 2: Confirm xóa.
- Lưu ý: chỉ người có quyền (creator/admin hoặc được cấp quyền) mới thấy/làm được thao tác xóa.

Hướng dẫn chấm công (Check-in / Check-out)
-------------------------------------------
- Mở `Attendance` widget trên Dashboard hoặc trang `Attendance`.
- Nhấn `Check In` khi đến công ty → hệ thống lưu một bản ghi `type: check_in` với timestamp hiện tại.
- Khi rời đi, nhấn `Check Out` → lưu bản ghi `type: check_out`.
- Kiểm tra lịch sử: phần `History` hiển thị danh sách check-in/check-out kèm nhãn `On-time`/`Late` (theo cài đặt `On-time` trong localStorage/Attendance Settings).
- Admin có thể xem `Admin Attendance Manager` để thấy danh sách check-in/checkout hôm nay, rankings, và debug RLS nếu cần.

Mô tả các bảng chính trong database
------------------------------------
(Dưới đây mô tả khái quát các bảng thường dùng; tên và cột cụ thể có thể thay đổi theo schema hiện tại trong `supabase`.)

1) `profiles`
- Mục đích: lưu thông tin người dùng (liên kết với Supabase Auth `users`).
- Các cột quan trọng: `id` (uuid), `full_name`, `email`, `phone`, `avatar_url`, `team_id`, `shift_id`, `role` (có thể lưu trong bảng `user_roles`), `created_at`.

2) `user_roles` (tuỳ schema)
- Mục đích: ánh xạ user -> role (admin | leader | staff).
- Cột: `user_id`, `role_name`.

3) `attendance`
- Mục đích: lưu check-in / check-out.
- Cột: `id`, `user_id`, `type` ("check_in" | "check_out"), `timestamp` (timestamptz), `location` (text / geo), `notes`.

4) `tasks`
- Mục đích: lưu task và trạng thái.
- Cột: `id`, `title`, `description`, `status` (có thể lưu trạng thái hoặc `column_id` tham chiếu `task_columns`), `column_id`, `creator_id`, `assignee_id`, `priority`, `deadline` (date/timestamptz), `created_at`, `updated_at`, `completed_at` (nullable), `metadata`.

5) `task_columns`
- Mục đích: cấu trúc cột cho board (To Do, In Progress, Review, Done).
- Cột: `id`, `name`, `position`, `is_default`, `created_by`.

6) `leave_requests`
- Mục đích: lưu đơn nghỉ phép.
- Cột: `id`, `user_id`, `type`, `start_date`, `end_date`, `status` (pending/approved/rejected), `created_at`, `approved_by`, `approved_at`, `rejection_reason`.

7) `notifications`
- Mục đích: lưu thông báo ứng dụng.
- Cột: `id`, `user_id`, `message`, `link`, `is_read`, `created_at`.

8) `room_bookings` hoặc `bookings`
- Mục đích: lưu booking phòng họp.
- Cột: `id`, `room_id`, `user_id`, `start_time`, `end_time`, `title`, `created_at`.

Lưu ý bảo mật & RLS (Row Level Security)
----------------------------------------
- Supabase thường bật RLS; cần chắc chắn các policy cho phép người dùng chỉ đọc dữ liệu của mình, và admin có quyền đọc/viết rộng hơn.
- Ví dụ: `attendance` nên có policy `SELECT` cho `user_id = auth.uid()` và một policy bổ sung cho role admin (ví dụ kiểm tra trong `user_roles` table).
- Hiện tại frontend có nhiều kiểm tra quyền (client-side). Để bảo mật thật sự, cần thêm policy server-side.

Lưu ý về timezone và hiển thị thời gian
--------------------------------------
- Timestamps lưu dưới dạng `timestamptz` (UTC-aware). Khi hiển thị, UI chuyển sang giờ địa phương của trình duyệt.
- Khi so sánh giờ để quyết định `On-time`/`Late`, hệ thống cần chuẩn hóa về cùng timezone trước khi so sánh (ví dụ convert cutoff `09:00` thành thời điểm `09:00` ở timezone của user cho ngày đó).

Mẹo vận hành & khắc phục sự cố nhanh
-------------------------------------
- Nếu thấy On-time bị đánh sai: mở DevTools Console và xem logs từ `AttendanceWidget` (các phiên bản gần đây log chi tiết timestamp, offset và kết luận On-time/Late) — copy log cho developer.
- Nếu Admin không thấy bản ghi attendance: kiểm tra RLS policy trên Supabase; có migration mẫu trong `supabase/migrations/` để cho admin quyền SELECT nếu cần.
- Nếu board chỉ hiển thị 2 cột thay vì 4: kiểm tra bảng `task_columns` trong DB; code hiện tại có cơ chế tạo các cột mặc định nếu thiếu, nhưng nên đảm bảo thứ tự/position đúng.

FAQ (Một số câu thường gặp)
---------------------------
Q: Tôi có thể chỉnh sửa nhiệm vụ của người khác không?
A: Nếu bạn là Admin: có. Nếu bạn là Leader/Staff: chỉ sửa task nếu bạn là `assignee` (một số UI có filter để mặc định hiển thị task của bạn); để cho phép leader chỉnh sửa task của người trong team cần bổ sung quyền hoặc policy server-side.

Q: Làm sao để thay đổi giờ On-time cho cả công ty?
A: Hiện tại cài đặt On-time được lưu trong `localStorage` (client). Để thay đổi ở mức tổ chức, cần tạo một bảng `organization_settings` và load server-side — có thể mở issue để nâng cấp.

Q: Làm sao để kiểm tra lịch sử check-in của một nhân viên?
A: Admin dùng `Admin Attendance Manager` để xem danh sách check-in/checkout hôm nay và lịch sử; Leader có thể xem lịch sử team (nếu policy cho phép).

Kết luận & bước tiếp theo
-------------------------
- File này là hướng dẫn cơ bản để người dùng và admin bắt đầu dùng VINE. Nếu bạn muốn tôi:
  - Thêm hướng dẫn bằng hình ảnh (screenshot) cho mỗi bước,
  - Tạo bản tiếng Anh (`VINE_USER_GUIDE_EN.md`),
  - Thêm SQL mẫu cho RLS policy (ví dụ cho `attendance` và `tasks`),
  - Hoặc cập nhật `DOCUMENTATION_INDEX.md` để link tới file này,
hãy cho tôi biết mục bạn muốn tiếp theo.

--
Tài liệu tạo tự động bởi trợ lý phát triển dự án. Nếu cần điều chỉnh tone (ngắn gọn hơn hoặc chi tiết kỹ thuật hơn), tôi sẽ cập nhật ngay.