export const RESPONSIVE_EDIT_RECONCILER_VERSION="1.0.0";

export function reconcileVisualEditAcrossDevices(intent,region,{target="app+website"}={}){
  const object=intent?.object||"layout-or-component",side=region?.region||"page";
  const imageSplit=object==="image"&&["left","right"].includes(side);
  const bottomAppend=side==="bottom";
  return Object.freeze({
    version:RESPONSIVE_EDIT_RECONCILER_VERSION,target,
    desktop:Object.freeze({
      strategy:imageSplit?"two-column-semantic-split":bottomAppend?"append-semantic-section":"recompose-within-layout-grid",
      order:imageSplit?(side==="left"?["new-image","existing-content"]:["existing-content","new-image"]):["existing-content","new-or-modified-content"],
      preservePrimaryAction:true,
    }),
    tablet:Object.freeze({strategy:imageSplit?"adaptive-two-column-when-space-allows":"adaptive-reflow",preservePrimaryAction:true}),
    mobile:Object.freeze({
      strategy:imageSplit?"single-column-semantic-stack":"single-column-reflow",
      order:imageSplit?["new-image","existing-content"]:["existing-content","new-or-modified-content"],
      horizontalPageScrollForbidden:true,
      thumbReachPriority:true,
    }),
    rules:Object.freeze({sameGeometryAcrossDevicesForbidden:true,functionalityLossForbidden:true,criticalActionDisplacementForbidden:true,minimumTouchTargetPx:44,reducedMotionPreserved:true}),
  });
}
