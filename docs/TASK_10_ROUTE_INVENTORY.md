# Task 10 Launch Route Inventory

Status key: **Launch-ready** | **Needs fix** | **Feature-flag** | **Hide before launch** | **Redirect** | **Remove**

## Public website

| Route | Status | Notes |
| ----- | ------ | ----- |
| `/` | Launch-ready | Updated hero, product loop, capabilities |
| `/product` | Launch-ready | Product story and trust section |
| `/pricing` | Launch-ready | Sourced from canonical plan catalogue |
| `/login` | Launch-ready | |
| `/signup` | Launch-ready | |
| `/privacy` | Launch-ready | Placeholder policy — legal review before commercial launch |
| `/terms` | Launch-ready | Placeholder terms — legal review before commercial launch |

## Command

| Route | Status | Notes |
| ----- | ------ | ----- |
| `/dashboard` | Launch-ready | Command Centre |
| `/operations` | Launch-ready | Operations (Activity removed from nav duplicate) |

## Execute

| Route | Status | Notes |
| ----- | ------ | ----- |
| `/advertising` | Launch-ready | |
| `/organic-social` | Launch-ready | |
| `/organic-social/accounts` | Launch-ready | Canonical accounts surface |
| `/organic-social/content` | Launch-ready | |
| `/organic-social/publishing` | Launch-ready | |
| `/organic-social/growth` | Launch-ready | |
| `/organic-social/community` | Feature-flag | Read-only community insights |
| `/content/studio` | Launch-ready | Canonical Content Studio |
| `/calendar` | Launch-ready | |

## Strategy

| Route | Status | Notes |
| ----- | ------ | ----- |
| `/brands` | Launch-ready | |
| `/advertising/audiences` | Launch-ready | |
| `/seo/competitors` | Launch-ready | |
| `/growth/insights` | Launch-ready | Growth Insights (Market Intelligence) |

## Measure

| Route | Status | Notes |
| ----- | ------ | ----- |
| `/analytics` | Launch-ready | |
| `/analytics/attribution` | Launch-ready | |
| `/analytics/revenue` | Launch-ready | Reports nav points here |
| `/experiments` | Launch-ready | Secondary — infrastructure present |

## Intelligence

| Route | Status | Notes |
| ----- | ------ | ----- |
| `/growth` | Launch-ready | Cresco Intelligence |
| `/copilot` | Launch-ready | Ask Cresco |
| `/automation` | Launch-ready | Automations |

## System

| Route | Status | Notes |
| ----- | ------ | ----- |
| `/integrations` | Launch-ready | Canonical integrations |
| `/settings` | Launch-ready | |
| `/onboarding` | Launch-ready | |

## Legacy redirects

| Route | Status | Destination |
| ----- | ------ | ----------- |
| `/content` | Redirect | `/content/studio` |
| `/connectors` | Redirect | `/integrations` |
| `/social` | Redirect | `/organic-social` |
| `/social/connections` | Redirect | `/organic-social/accounts` |
| `/social/reels` | Redirect | `/organic-social/content` |
| `/social/performance` | Redirect | `/organic-social/content` |
| `/analyst` | Redirect | `/copilot` |
| `/ai-agents` | Redirect | `/growth` |

## Dev / preview routes

| Route | Status | Notes |
| ----- | ------ | ----- |
| `/dev/*` | Hide before launch | Blocked in production via middleware |

## Hidden / secondary (not in primary nav)

| Route | Status | Notes |
| ----- | ------ | ----- |
| `/campaigns` | Launch-ready | Secondary navigation |
| `/publishing` | Launch-ready | Secondary navigation |
| `/data` | Launch-ready | Data Hub — admin-oriented |
| `/crm/*` | Hide before launch | Not in launch nav |
| `/email/*` | Hide before launch | Not in launch nav |
| `/visual-studio` | Hide before launch | Not launch-critical |

## Removed from launch navigation

| Item | Status | Notes |
| ---- | ------ | ----- |
| Agents (`/ai-agents`) | Redirect | Redirects to `/growth` |
| Activity duplicate | Remove | Was duplicate of Operations |
| Legacy Content Studio (`/content`) | Redirect | Canonical `/content/studio` |
