import { useQuery } from '@tanstack/react-query'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { t } from '@/i18n'
import { catalogService } from '@/services'

import type { Notice } from '../shared'
import { ChecklistTab } from './ChecklistTab'
import { DestinationsTab } from './DestinationsTab'
import { PlacesTab } from './PlacesTab'
import { Loading } from './catalogShared'

/** Danh mục: the data AI clone plans from. Needs the categories module. */
export function CatalogPanel({ onNotice }: { onNotice: (notice: Notice) => void }) {
  const meta = useQuery({ queryKey: ['admin', 'catalog', 'meta'], queryFn: catalogService.getMeta, staleTime: Infinity })
  const destinations = useQuery({ queryKey: ['admin', 'catalog', 'destinations'], queryFn: catalogService.listDestinations })

  if (meta.isPending || destinations.isPending) return <Loading text={t('Đang tải danh mục…')} />
  if (meta.isError) return <p className="text-sm text-destructive">{(meta.error as Error).message}</p>
  if (destinations.isError) return <p className="text-sm text-destructive">{(destinations.error as Error).message}</p>

  const list = destinations.data.items

  return (
    <Tabs defaultValue="places" className="space-y-5">
      <TabsList className="flex w-full flex-wrap sm:w-auto">
        <TabsTrigger value="places">{t('Địa điểm')}</TabsTrigger>
        <TabsTrigger value="destinations">{t('Điểm đến')}</TabsTrigger>
        <TabsTrigger value="checklist">{t('Checklist chuẩn bị')}</TabsTrigger>
      </TabsList>
      <TabsContent value="places">
        <PlacesTab meta={meta.data} destinations={list} onNotice={onNotice} />
      </TabsContent>
      <TabsContent value="destinations">
        <DestinationsTab destinations={list} onNotice={onNotice} />
      </TabsContent>
      <TabsContent value="checklist">
        <ChecklistTab meta={meta.data} onNotice={onNotice} />
      </TabsContent>
    </Tabs>
  )
}
