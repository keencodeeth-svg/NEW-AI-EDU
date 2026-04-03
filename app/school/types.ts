import type {
  SchoolClassroomDeliveryDetailPayload,
  SchoolClassroomDeliverySummary,
} from "@/lib/classroom-integration";
import type { SchoolClassRecord, SchoolOverview, SchoolUserRecord } from "@/lib/school-admin-types";

export type SchoolOverviewResponse = {
  data?: SchoolOverview | null;
};

export type SchoolClassesResponse = {
  data?: SchoolClassRecord[];
};

export type SchoolUsersResponse = {
  data?: SchoolUserRecord[];
};

export type SchoolClassroomDeliveriesResponse = {
  data?: SchoolClassroomDeliverySummary | null;
};

export type SchoolClassroomDeliveryDetailResponse = {
  data?: SchoolClassroomDeliveryDetailPayload | null;
};
