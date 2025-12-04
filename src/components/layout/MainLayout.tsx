// src/components/layout/MainLayout.tsx
import type { ReactNode } from "react";
import {
  AppBar,
  Box,
  Toolbar,
  Typography,
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Button,
  Chip,
  Divider,
} from "@mui/material";
import DashboardIcon from "@mui/icons-material/Dashboard";
import PlaceIcon from "@mui/icons-material/Place";
import LocalOfferIcon from "@mui/icons-material/LocalOffer";
import TimelineIcon from "@mui/icons-material/Timeline";
import LogoutIcon from "@mui/icons-material/Logout";
import CampaignIcon from "@mui/icons-material/Campaign"; 
import PowerIcon from "@mui/icons-material/Power";
import { Link as RouterLink, useLocation } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";

interface MainLayoutProps {
  children: ReactNode;
}

const drawerWidth = 220;

export function MainLayout({ children }: MainLayoutProps) {
  const { user, role, signOutUser } = useAuth();
  const location = useLocation();

  const navItems = [
    {
      label: "Dashboard",
      to: "/",
      icon: <DashboardIcon fontSize="small" />,
      match: (path: string) => path === "/",
    },
    {
      label: "Locations",
      to: "/locations",
      icon: <PlaceIcon fontSize="small" />,
      match: (path: string) =>
        path === "/locations" || path.startsWith("/locations/"),
    },
    {
      label: "Promotions",
      to: "/promotions",
      icon: <LocalOfferIcon fontSize="small" />,
      match: (path: string) => path.startsWith("/promotions"),
    },
    {
      label: "Campaigns",               // 👈 NEW
      to: "/campaigns",
      icon: <CampaignIcon fontSize="small" />,
      match: (path: string) => path.startsWith("/campaigns"),
    },
    {
      label: "Units",
      to: "/units",
      icon: <PowerIcon fontSize="small" />,
      match: (path: string) => path === "/units" || path.startsWith("/units/"),
    },
    {
      label: "Sessions",
      to: "/sessions",
      icon: <TimelineIcon fontSize="small" />,
      match: (path: string) => path.startsWith("/sessions"),
    },
  ];

  const handleLogout = () => {
    void signOutUser();
  };

  return (
    <Box sx={{ display: "flex", minHeight: "100vh" }}>
      {/* ---------- Sidebar Drawer ---------- */}
      <Drawer
        variant="permanent"
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          "& .MuiDrawer-paper": {
            width: drawerWidth,
            boxSizing: "border-box",
          },
        }}
      >
        {/* Sidebar header */}
        <Toolbar>
          <Typography
            variant="h6"
            noWrap
            component={RouterLink}
            to="/"
            sx={{
              textDecoration: "none",
              color: "inherit",
              fontWeight: 600,
            }}
          >
            Opencharge
          </Typography>
        </Toolbar>
        <Divider />

        {/* Nav items */}
        <List sx={{ py: 1 }}>
          {navItems.map((item) => {
            const selected = item.match(location.pathname);
            return (
              <ListItemButton
                key={item.label}
                component={RouterLink}
                to={item.to}
                selected={selected}
                sx={{
                  borderRadius: 1,
                  mx: 1,
                  mb: 0.5,
                }}
              >
                <ListItemIcon sx={{ minWidth: 36 }}>
                  {item.icon}
                </ListItemIcon>
                <ListItemText primary={item.label} />
              </ListItemButton>
            );
          })}
        </List>

        <Box sx={{ flexGrow: 1 }} />

        {/* Footer area in sidebar (optional) */}
        <Box sx={{ p: 2 }}>
          {role && (
            <Chip
              label={role}
              size="small"
              sx={{ mb: 1 }}
              color={
                role === "admin"
                  ? "success"
                  : role === "operator"
                  ? "info"
                  : "default"
              }
            />
          )}
          {user && (
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ display: "block", mb: 1 }}
            >
              {user.email}
            </Typography>
          )}
          {user && (
            <Button
              variant="outlined"
              size="small"
              fullWidth
              startIcon={<LogoutIcon fontSize="small" />}
              onClick={handleLogout}
            >
              Logout
            </Button>
          )}
        </Box>
      </Drawer>

      {/* ---------- Top AppBar ---------- */}
      <AppBar
        position="fixed"
        sx={{
          zIndex: (theme) => theme.zIndex.drawer + 1,
          ml: `${drawerWidth}px`,
          width: `calc(100% - ${drawerWidth}px)`,
        }}
        color="default"
        elevation={0}
      >
        <Toolbar>
          <Typography variant="h6" noWrap component="div">
            Opencharge Admin
          </Typography>
        </Toolbar>
      </AppBar>

      {/* ---------- Main Content ---------- */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
        }}
      >
        {/* Spacer for AppBar */}
        <Toolbar />
        {children}
      </Box>
    </Box>
  );
}