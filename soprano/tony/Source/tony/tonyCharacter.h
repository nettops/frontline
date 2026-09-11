// Copyright Epic Games, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Character.h"
#include "tonyCharacter.generated.h"

class UCameraComponent;
class USpringArmComponent;

/**
 *  A controllable top-down perspective character
 */
UCLASS(abstract)
class AtonyCharacter : public ACharacter
{
	GENERATED_BODY()

private:

	/** Top down camera */
	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category="Components", meta = (AllowPrivateAccess = "true"))
	TObjectPtr<UCameraComponent> TopDownCameraComponent;

	/** Camera boom positioning the camera above the character */
	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category="Components", meta = (AllowPrivateAccess = "true"))
	TObjectPtr<USpringArmComponent> CameraBoom;

public:

	/** Constructor */
	AtonyCharacter();

	/** Initialization */
	virtual void BeginPlay() override;

	/** Update */
	virtual void Tick(float DeltaSeconds) override;

	/** Returns the camera component **/
	UCameraComponent* GetTopDownCameraComponent() const { return TopDownCameraComponent.Get(); }

	/** Returns the Camera Boom component **/
	USpringArmComponent* GetCameraBoom() const { return CameraBoom.Get(); }

protected:

	/** Bound directly to the two scroll key events below — no Input Action
	 *  asset and no Axis Mapping to configure in Project Settings. The
	 *  first version used BindAxis("MouseWheelAxis", ...), which silently
	 *  does nothing without a matching Axis Mapping already registered —
	 *  this template has none, being Enhanced-Input-only, so scroll had
	 *  nothing to attach to and never fired. Coexists fine with Enhanced
	 *  Input regardless; both attach to the same InputComponent. */
	virtual void SetupPlayerInputComponent(UInputComponent* PlayerInputComponent) override;

	/** section 15's "Exploration Camera... zoom" — clamped arm-length
	 *  zoom rather than FOV, so perspective distortion doesn't change with
	 *  it the way it would zooming the lens instead. One fixed step per
	 *  discrete wheel notch, not a continuous axis. */
	void ZoomIn();
	void ZoomOut();
	void ZoomBy(float Delta);

	UPROPERTY(EditAnywhere, Category="Camera")
	float MinArmLength = 400.f;

	UPROPERTY(EditAnywhere, Category="Camera")
	float MaxArmLength = 1400.f;

	UPROPERTY(EditAnywhere, Category="Camera")
	float ZoomSpeed = 60.f;

};

