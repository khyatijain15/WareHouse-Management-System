import { useAuth } from '@/contexts/AuthContext';

export type UserRole = 'maker' | 'checker' | 'admin';

export interface RolePermissions {
  dashboard: {
    view: boolean;
    fullAccess: boolean;
  };
  surveys: {
    create: boolean;
    edit: boolean;
    view: boolean;
    approve: boolean;
    reject: boolean;
    resubmit: boolean;
    activate: boolean;
    reactivate: boolean;
    close: boolean;
  };
  inward: {
    create: boolean;
    edit: boolean;
    view: boolean;
    approve: boolean;
    reject: boolean;
    cir: {
      view: boolean;
      approve: boolean;
      reject: boolean;
      resubmit: boolean;
    };
    storageReceipt: {
      view: boolean;
      generate: boolean;
      print: boolean;
    };
    warehouseReceipt: {
      view: boolean;
      generate: boolean;
      print: boolean;
    };
  };
  outward: {
    create: boolean;
    edit: boolean;
    view: boolean;
    approve: boolean;
    reject: boolean;
    resubmit: boolean;
    pdf: {
      view: boolean;
      print: boolean;
    };
  };
  deliveryOrders: {
    create: boolean;
    edit: boolean;
    view: boolean;
    approve: boolean;
    reject: boolean;
    resubmit: boolean;
    pdf: {
      view: boolean;
      print: boolean;
    };
  };
  releaseOrders: {
    create: boolean;
    edit: boolean;
    view: boolean;
    approve: boolean;
    reject: boolean;
    resubmit: boolean;
    pdf: {
      view: boolean;
      print: boolean;
    };
  };
  reports: {
    view: boolean;
    export: boolean;
  };
  masterData: {
    view: boolean;
    edit: boolean;
    create: boolean;
  };
  admin: {
    userManagement: boolean;
    systemSettings: boolean;
  };
}

// Define permissions for each role
const ROLE_PERMISSIONS: Record<UserRole, RolePermissions> = {
  maker: {
    dashboard: {
      view: true,
      fullAccess: true,
    },
    surveys: {
      create: true,
      edit: true, // Can edit in PENDING and RESUBMIT status
      view: true,
      approve: false,
      reject: false,
      resubmit: false,
      activate: false,
      reactivate: false,
      close: false,
    },
    inward: {
      create: true,
      edit: true,
      view: true,
      approve: false,
      reject: false,
      cir: {
        view: true, // Read-only access
        approve: false,
        reject: false,
        resubmit: false,
      },
      storageReceipt: {
        view: true, // Read-only access
        generate: false,
        print: true, // Can print PDFs
      },
      warehouseReceipt: {
        view: true, // Read-only access
        generate: false,
        print: true, // Can print PDFs
      },
    },
    outward: {
      create: true,  // Maker can fill form and submit
      edit: false,   // Cannot edit existing outwards
      view: true,    // Can view outward data (read-only)
      approve: false, // Cannot approve - hidden
      reject: false,  // Cannot reject - hidden
      resubmit: false, // Cannot resubmit - hidden
      pdf: {
        view: true,   // Can access PDF generation
        print: true,  // Can print PDFs
      },
    },
    deliveryOrders: {
      create: true,  // Maker can fill form and submit
      edit: false,   // Cannot edit existing DOs
      view: true,    // Can view DO data (read-only)
      approve: false, // Cannot approve - hidden
      reject: false,  // Cannot reject - hidden
      resubmit: false, // Cannot resubmit - hidden
      pdf: {
        view: true,   // Can access PDF generation
        print: true,  // Can print PDFs
      },
    },
    releaseOrders: {
      create: true,  // Maker can fill form and submit
      edit: false,   // Cannot edit existing ROs
      view: true,    // Can view RO data (read-only)
      approve: false, // Cannot approve - hidden
      reject: false,  // Cannot reject - hidden
      resubmit: false, // Cannot resubmit - hidden
      pdf: {
        view: true,   // Can access PDF generation
        print: true,  // Can print PDFs
      },
    },
    reports: {
      view: true,
      export: true,
    },
    masterData: {
      view: false,
      edit: false,
      create: false,
    },
    admin: {
      userManagement: false,
      systemSettings: false,
    },
  },
  checker: {
    dashboard: {
      view: true,
      fullAccess: true,
    },
    surveys: {
      create: false,
      edit: false,
      view: true,
      approve: true,
      reject: true,
      resubmit: true,
      activate: true,
      reactivate: true,
      close: true,
    },
    inward: {
      create: false, // Read-only for entry creation
      edit: false, // Read-only for entry editing
      view: true,
      approve: false, // Legacy - use CIR approve instead
      reject: false, // Legacy - use CIR reject instead
      cir: {
        view: true,
        approve: true, // Can approve CIR
        reject: true, // Can reject CIR
        resubmit: true, // Can resubmit CIR
      },
      storageReceipt: {
        view: true,
        generate: true, // Can generate SR
        print: true, // Can print PDFs
      },
      warehouseReceipt: {
        view: true,
        generate: true, // Can generate WR
        print: true, // Can print PDFs
      },
    },
    outward: {
      create: false, // Checker cannot create new outwards
      edit: false,   // Cannot edit (read-only except status)
      view: true,    // Can view outward data (read-only)
      approve: true, // Can approve outwards
      reject: true,  // Can reject outwards
      resubmit: true, // Can resubmit outwards
      pdf: {
        view: true,   // Can access PDF generation
        print: true,  // Can print PDFs
      },
    },
    deliveryOrders: {
      create: false, // Checker cannot create new DOs
      edit: false,   // Cannot edit (read-only except status)
      view: true,    // Can view DO data (read-only)
      approve: true, // Can approve DOs
      reject: true,  // Can reject DOs
      resubmit: true, // Can resubmit DOs
      pdf: {
        view: true,   // Can access PDF generation
        print: true,  // Can print PDFs
      },
    },
    releaseOrders: {
      create: false, // Checker cannot create new ROs
      edit: false,   // Cannot edit (read-only except status)
      view: true,    // Can view RO data (read-only)
      approve: true, // Can approve ROs
      reject: true,  // Can reject ROs  
      resubmit: true, // Can resubmit ROs
      pdf: {
        view: true,   // Can access PDF generation
        print: true,  // Can print PDFs
      },
    },
    reports: {
      view: true,
      export: true,
    },
    masterData: {
      view: true,
      edit: true,
      create: true,
    },
    admin: {
      userManagement: false,
      systemSettings: false,
    },
  },
  admin: {
    dashboard: {
      view: true,
      fullAccess: true,
    },
    surveys: {
      create: true,
      edit: true,
      view: true,
      approve: true,
      reject: true,
      resubmit: true,
      activate: true,
      reactivate: true,
      close: true,
    },
    inward: {
      create: true,
      edit: true,
      view: true,
      approve: true,
      reject: true,
      cir: {
        view: true,
        approve: true,
        reject: true,
        resubmit: true,
      },
      storageReceipt: {
        view: true,
        generate: true,
        print: true,
      },
      warehouseReceipt: {
        view: true,
        generate: true,
        print: true,
      },
    },
    outward: {
      create: true,  // Admin has full access
      edit: true,    // Can edit outwards
      view: true,    // Can view outward data
      approve: true, // Can approve outwards
      reject: true,  // Can reject outwards
      resubmit: true, // Can resubmit outwards
      pdf: {
        view: true,   // Can access PDF generation
        print: true,  // Can print PDFs
      },
    },
    deliveryOrders: {
      create: true,  // Admin has full access
      edit: true,    // Can edit DOs
      view: true,    // Can view DO data
      approve: true, // Can approve DOs
      reject: true,  // Can reject DOs
      resubmit: true, // Can resubmit DOs
      pdf: {
        view: true,   // Can access PDF generation
        print: true,  // Can print PDFs
      },
    },
    releaseOrders: {
      create: true,  // Admin has full access
      edit: true,    // Can edit ROs
      view: true,    // Can view RO data
      approve: true, // Can approve ROs
      reject: true,  // Can reject ROs
      resubmit: true, // Can resubmit ROs
      pdf: {
        view: true,   // Can access PDF generation
        print: true,  // Can print PDFs
      },
    },
    reports: {
      view: true,
      export: true,
    },
    masterData: {
      view: true,
      edit: true,
      create: true,
    },
    admin: {
      userManagement: true,
      systemSettings: true,
    },
  },
};

export function useRoleAccess() {
  const { user } = useAuth();
  const userRole = (user?.role as UserRole) || 'maker';

  const permissions = ROLE_PERMISSIONS[userRole];

  // Helper functions for common permission checks
  const canAccess = (module: keyof RolePermissions, action: string): boolean => {
    const modulePermissions = permissions[module] as any;
    return modulePermissions[action] || false;
  };

  const canEditSurvey = (status: string): boolean => {
    if (userRole === 'admin') return true;
    if (userRole === 'checker') return true;
    if (userRole === 'maker') {
      // Maker can only edit in PENDING and RESUBMIT status
      return status?.toLowerCase() === 'pending' || status?.toLowerCase() === 'resubmit' || status?.toLowerCase() === 'resubmitted';
    }
    return false;
  };

  const canApproveSurvey = (status: string): boolean => {
    if (userRole === 'admin') return true;
    if (userRole === 'checker') return true;
    return false;
  };

  const showSurveyActions = (status: string): boolean => {
    if (userRole === 'admin') return true;
    if (userRole === 'checker') {
      // Checker can see actions only in ACTIVATE, REACTIVATE, and CLOSED tabs
      const statusLower = status?.toLowerCase();
      return statusLower === 'activate' || statusLower === 'activated' || 
             statusLower === 'reactivate' || statusLower === 'reactivated' ||
             statusLower === 'close' || statusLower === 'closed';
    }
    if (userRole === 'maker') {
      // Maker can only see actions in editable states
      return status?.toLowerCase() === 'pending' || status?.toLowerCase() === 'resubmit' || status?.toLowerCase() === 'resubmitted';
    }
    return false;
  };

  const canAccessSurveyTab = (tabStatus: string): boolean => {
    if (userRole === 'admin') return true;
    if (userRole === 'checker') return true;
    if (userRole === 'maker') {
      // Maker can access all tabs but with different permissions
      return true;
    }
    return false;
  };

  const getSurveyTabMode = (tabStatus: string): 'edit' | 'view' => {
    if (userRole === 'admin') return 'edit';
    if (userRole === 'checker') return 'edit';
      // {
      // // Checker can edit only in ACTIVATE, REACTIVATE, and CLOSED tabs
      // const status = tabStatus?.toLowerCase();
      // if (status === 'activate' || status === 'activated' || 
      //     status === 'reactivate' || status === 'reactivated' ||
      //     status === 'close' || status === 'closed') {
      //   return 'edit';
      // }
      // return 'view'; // PENDING, REJECT, RESUBMIT tabs are read-only for checker
  // }
    if (userRole === 'maker') {
      // Maker can only edit in PENDING and RESUBMIT tabs
      const status = tabStatus?.toLowerCase();
      if (status === 'pending' || status === 'resubmit' || status === 'resubmitted') {
        return 'edit';
      }
      return 'view';
    }
    return 'view';
  };

  const canEditWarehouseName = (): boolean => {
    // Only admin can edit warehouse name
    return userRole === 'admin';
  };

  const canAccessInsuranceFunction = (status: string): boolean => {
    if (userRole === 'admin') return true;
    if (userRole === 'checker') {
      // Checker can access insurance functionality in ACTIVATE, REACTIVATE, and CLOSED tabs
      const statusLower = status?.toLowerCase();
      return statusLower === 'activate' || statusLower === 'activated' || 
             statusLower === 'reactivate' || statusLower === 'reactivated' ||
             statusLower === 'close' || statusLower === 'closed';
    }
    return false;
  };

  // Inward-specific permission functions
  const canCreateInwardEntry = (): boolean => {
    return permissions.inward.create;
  };

  const canEditInwardEntry = (): boolean => {
    return permissions.inward.edit;
  };

  const canViewCIR = (): boolean => {
    return permissions.inward.cir.view;
  };

  const canApproveCIR = (): boolean => {
    return permissions.inward.cir.approve;
  };

  const canRejectCIR = (): boolean => {
    return permissions.inward.cir.reject;
  };

  const canResubmitCIR = (): boolean => {
    return permissions.inward.cir.resubmit;
  };

  const canViewStorageReceipt = (): boolean => {
    return permissions.inward.storageReceipt.view;
  };

  const canGenerateStorageReceipt = (): boolean => {
    return permissions.inward.storageReceipt.generate;
  };

  const canPrintStorageReceipt = (): boolean => {
    return permissions.inward.storageReceipt.print;
  };

  const canViewWarehouseReceipt = (): boolean => {
    return permissions.inward.warehouseReceipt.view;
  };

  const canGenerateWarehouseReceipt = (): boolean => {
    return permissions.inward.warehouseReceipt.generate;
  };

  const canPrintWarehouseReceipt = (): boolean => {
    return permissions.inward.warehouseReceipt.print;
  };

  const showCIRActionButtons = (): boolean => {
    // Show CIR action buttons (Approve/Reject/Resubmit) only if user can perform any of these actions
    return canApproveCIR() || canRejectCIR() || canResubmitCIR();
  };

  const getInwardEntryMode = (): 'edit' | 'view' => {
    return canCreateInwardEntry() || canEditInwardEntry() ? 'edit' : 'view';
  };

  // Release Order-specific permission functions
  const canCreateReleaseOrder = (): boolean => {
    return permissions.releaseOrders.create;
  };

  const canEditReleaseOrder = (): boolean => {
    return permissions.releaseOrders.edit;
  };

  const canViewReleaseOrder = (): boolean => {
    return permissions.releaseOrders.view;
  };

  const canApproveReleaseOrder = (): boolean => {
    return permissions.releaseOrders.approve;
  };

  const canRejectReleaseOrder = (): boolean => {
    return permissions.releaseOrders.reject;
  };

  const canResubmitReleaseOrder = (): boolean => {
    return permissions.releaseOrders.resubmit;
  };

  const canViewROPDF = (): boolean => {
    return permissions.releaseOrders.pdf.view;
  };

  const canPrintROPDF = (): boolean => {
    return permissions.releaseOrders.pdf.print;
  };

  const showROActionButtons = (): boolean => {
    // Show RO action buttons (Approve/Reject/Resubmit) only if user can perform any of these actions
    return canApproveReleaseOrder() || canRejectReleaseOrder() || canResubmitReleaseOrder();
  };

  const canEditRORemark = (): boolean => {
    // Can edit remark if can perform status actions
    return showROActionButtons();
  };

  // Delivery Order-specific permission functions
  const canCreateDeliveryOrder = (): boolean => {
    return permissions.deliveryOrders.create;
  };

  const canEditDeliveryOrder = (): boolean => {
    return permissions.deliveryOrders.edit;
  };

  const canViewDeliveryOrder = (): boolean => {
    return permissions.deliveryOrders.view;
  };

  const canApproveDeliveryOrder = (): boolean => {
    return permissions.deliveryOrders.approve;
  };

  const canRejectDeliveryOrder = (): boolean => {
    return permissions.deliveryOrders.reject;
  };

  const canResubmitDeliveryOrder = (): boolean => {
    return permissions.deliveryOrders.resubmit;
  };

  const canViewDOPDF = (): boolean => {
    return permissions.deliveryOrders.pdf.view;
  };

  const canPrintDOPDF = (): boolean => {
    return permissions.deliveryOrders.pdf.print;
  };

  const showDOActionButtons = (): boolean => {
    // Show DO action buttons (Approve/Reject/Resubmit) only if user can perform any of these actions
    return canApproveDeliveryOrder() || canRejectDeliveryOrder() || canResubmitDeliveryOrder();
  };

  const canEditDORemark = (): boolean => {
    // Can edit remark if can perform status actions
    return showDOActionButtons();
  };

  // Outward-specific permission functions
  const canCreateOutward = (): boolean => {
    return permissions.outward.create;
  };

  const canEditOutward = (): boolean => {
    return permissions.outward.edit;
  };

  const canViewOutward = (): boolean => {
    return permissions.outward.view;
  };

  const canApproveOutward = (): boolean => {
    return permissions.outward.approve;
  };

  const canRejectOutward = (): boolean => {
    return permissions.outward.reject;
  };

  const canResubmitOutward = (): boolean => {
    return permissions.outward.resubmit;
  };

  const canViewOutwardPDF = (): boolean => {
    return permissions.outward.pdf.view;
  };

  const canPrintOutwardPDF = (): boolean => {
    return permissions.outward.pdf.print;
  };

  const showOutwardActionButtons = (): boolean => {
    // Show Outward action buttons (Approve/Reject/Resubmit) only if user can perform any of these actions
    return canApproveOutward() || canRejectOutward() || canResubmitOutward();
  };

  const canEditOutwardRemark = (): boolean => {
    // Can edit remark if can perform status actions
    return showOutwardActionButtons();
  };

  return {
    userRole,
    permissions,
    canAccess,
    canEditSurvey,
    canApproveSurvey,
    showSurveyActions,
    canAccessSurveyTab,
    getSurveyTabMode,
    canEditWarehouseName,
    canAccessInsuranceFunction,
    // Inward permissions
    canCreateInwardEntry,
    canEditInwardEntry,
    canViewCIR,
    canApproveCIR,
    canRejectCIR,
    canResubmitCIR,
    canViewStorageReceipt,
    canGenerateStorageReceipt,
    canPrintStorageReceipt,
    canViewWarehouseReceipt,
    canGenerateWarehouseReceipt,
    canPrintWarehouseReceipt,
    showCIRActionButtons,
    getInwardEntryMode,
    // Release Order permissions
    canCreateReleaseOrder,
    canEditReleaseOrder,
    canViewReleaseOrder,
    canApproveReleaseOrder,
    canRejectReleaseOrder,
    canResubmitReleaseOrder,
    canViewROPDF,
    canPrintROPDF,
    showROActionButtons,
    canEditRORemark,
    // Delivery Order permissions
    canCreateDeliveryOrder,
    canEditDeliveryOrder,
    canViewDeliveryOrder,
    canApproveDeliveryOrder,
    canRejectDeliveryOrder,
    canResubmitDeliveryOrder,
    canViewDOPDF,
    canPrintDOPDF,
    showDOActionButtons,
    canEditDORemark,
    // Outward permissions
    canCreateOutward,
    canEditOutward,
    canViewOutward,
    canApproveOutward,
    canRejectOutward,
    canResubmitOutward,
    canViewOutwardPDF,
    canPrintOutwardPDF,
    showOutwardActionButtons,
    canEditOutwardRemark,
  };
}
