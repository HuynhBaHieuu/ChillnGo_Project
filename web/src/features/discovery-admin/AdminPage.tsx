import { BarChart3, ClipboardCheck, Users } from 'lucide-react'

import { PageContainer, PageHeader } from '@/app/layout/PageContainer'
import { EmptyState } from '@/components/EmptyState'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

/**
 * Admin shell.
 *
 * Tabs and empty states only — no moderation, user management or analytics
 * logic this week. The reads these tabs will use already exist in
 * `discovery.service.ts` (`getModerationQueue`, `getAllUsers`, `getAdminStats`)
 * and are deliberately not wired up yet.
 */
export function AdminPage() {
  return (
    <PageContainer>
      <PageHeader
        title="Quản trị"
        description="Khu vực dành cho ban quản trị ChillnGo. Phần logic sẽ được nối sau khi API sẵn sàng."
      />

      <Tabs defaultValue="moderation" className="animate-fade-rise-delay">
        <TabsList>
          <TabsTrigger value="moderation">Duyệt bài</TabsTrigger>
          <TabsTrigger value="users">Người dùng</TabsTrigger>
          <TabsTrigger value="stats">Thống kê</TabsTrigger>
        </TabsList>

        <TabsContent value="moderation">
          <EmptyState
            icon={ClipboardCheck}
            title="Hàng đợi duyệt bài"
            description="Danh sách bài viết chờ duyệt sẽ hiển thị ở đây, kèm thao tác duyệt và từ chối."
          />
        </TabsContent>

        <TabsContent value="users">
          <EmptyState
            icon={Users}
            title="Quản lý người dùng"
            description="Tìm kiếm, phân quyền và khoá tài khoản sẽ nằm ở tab này."
          />
        </TabsContent>

        <TabsContent value="stats">
          <EmptyState
            icon={BarChart3}
            title="Thống kê"
            description="Số bài viết, lượt clone và người dùng hoạt động theo thời gian."
          />
        </TabsContent>
      </Tabs>
    </PageContainer>
  )
}
