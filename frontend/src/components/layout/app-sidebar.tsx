import { useAuthStore } from '@/stores/auth-store'
import { useLayout } from '@/context/layout-provider'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from '@/components/ui/sidebar'
// import { AppTitle } from './app-title'
import { sidebarData } from './data/sidebar-data'
import { NavGroup } from './nav-group'
import { NavUser } from './nav-user'
import { TeamSwitcher } from './team-switcher'

export function AppSidebar() {
  const { collapsible, variant } = useLayout()
  const user=useAuthStore(s=>s.auth.user)
  const role=user?.role[0]??''
  const allowed:Record<string,string[]>={'/':['customer','teller','fraud_analyst','admin'],'/customers':['teller'],'/accounts':['customer','teller'],'/transactions':['customer','teller','fraud_analyst'],'/fraud-alerts':['fraud_analyst'],'/users':['admin'],'/operations':['admin','teller','fraud_analyst']}
  const groups=sidebarData.navGroups.map(g=>({...g,items:g.items.filter(i=>i.url&&allowed[i.url]?.includes(role))}))
  return (
    <Sidebar collapsible={collapsible} variant={variant}>
      <SidebarHeader>
        <TeamSwitcher teams={sidebarData.teams} />

        {/* Replace <TeamSwitch /> with the following <AppTitle />
         /* if you want to use the normal app title instead of TeamSwitch dropdown */}
        {/* <AppTitle /> */}
      </SidebarHeader>
      <SidebarContent>
        {groups.map((props) => (
          <NavGroup key={props.title} {...props} />
        ))}
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={{name:user?.email??'',email:role,avatar:''}} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
