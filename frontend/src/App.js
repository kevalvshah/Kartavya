/**
 * App.js — Kartavya by Aekam Inc
 * Invite-only auth · Projects + per-project boards · Dynamic columns · 4 views
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BrowserRouter, Routes, Route, Navigate,
  useLocation, useNavigate, useParams, Outlet,
} from "react-router-dom";
import { Analytics } from "@vercel/analytics/react";
import "./App.css";
import { cn } from "./lib/utils";
import { api } from "./lib/api";
import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";
import { Select } from "./components/ui/select";
import { Modal } from "./components/ui/modal";
import { Badge } from "./components/ui/badge";
import { ToastProvider, useToast } from "./components/ui/toast";
import TeamsPage from "./pages/TeamsPage";
import NotificationsSettingsPage from "./pages/NotificationsSettingsPage";
import { NotificationsModal } from "./components/NotificationsModal";
import {
  Bell, FolderKanban, LayoutGrid, ListTodo, LogOut,
  Plus, Settings, Sun, Moon, Users, ShieldCheck, Trash2,
  Copy, Check, Mail, ChevronRight, GripVertical,
  Pencil, Calendar, BarChart3, AlignLeft, Kanban,
  X, CheckCircle2,
} from "lucide-react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
